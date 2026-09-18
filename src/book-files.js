import { requireRoles, requireRolesOrOwner } from "./authorization.js";

const fileTypes = {
  manuscript: {
    maxBytes: 95 * 1024 * 1024,
    allowed: new Set(["application/pdf", "application/epub+zip"]),
    keyColumn: "book_object_key",
    nameColumn: "manuscript_original_name",
    typeColumn: "manuscript_content_type",
    sizeColumn: "manuscript_size",
    uploadedColumn: "manuscript_uploaded_at",
  },
  cover: {
    maxBytes: 10 * 1024 * 1024,
    allowed: new Set(["image/jpeg", "image/png"]),
    keyColumn: "cover_object_key",
    nameColumn: "cover_original_name",
    typeColumn: "cover_content_type",
    sizeColumn: "cover_size",
    uploadedColumn: "cover_uploaded_at",
  },
};

const bulkFile = {
  maxBytes: 95 * 1024 * 1024,
  allowed: new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.oasis.opendocument.spreadsheet",
    "text/csv",
    "text/tab-separated-values",
  ]),
};

function error(message, status) {
  return Response.json({ error: message }, { status });
}

function trustedOrigin(request, env) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const requestOrigin = new URL(request.url).origin;
  const configured = env.BETTER_AUTH_URL
    ? new URL(env.BETTER_AUTH_URL).origin
    : requestOrigin;
  return origin === requestOrigin || origin === configured;
}

function cleanFilename(value) {
  const name = String(value || "").trim().slice(0, 255);
  return name.replace(/[\u0000-\u001f\u007f]/g, "").replace(/[\\/]/g, "_");
}

function decodeFilename(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extension(contentType) {
  return {
    "application/pdf": "pdf",
    "application/epub+zip": "epub",
    "image/jpeg": "jpg",
    "image/png": "png",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.oasis.opendocument.spreadsheet": "ods",
    "text/csv": "csv",
    "text/tab-separated-values": "tsv",
  }[contentType];
}

export function signatureIsValid(bytes, contentType) {
  if (contentType === "application/pdf") {
    return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  }
  if (contentType === "application/epub+zip") {
    if (bytes.length < 58 || bytes[0] !== 0x50 || bytes[1] !== 0x4b ||
        bytes[2] !== 0x03 || bytes[3] !== 0x04) return false;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const compression = view.getUint16(8, true);
    const filenameLength = view.getUint16(26, true);
    const extraLength = view.getUint16(28, true);
    const filenameStart = 30;
    const dataStart = filenameStart + filenameLength + extraLength;
    const expectedType = "application/epub+zip";
    if (compression !== 0 || dataStart + expectedType.length > bytes.length) return false;
    const filename = new TextDecoder().decode(bytes.slice(filenameStart, filenameStart + filenameLength));
    const mimetype = new TextDecoder().decode(bytes.slice(dataStart, dataStart + expectedType.length));
    return filename === "mimetype" && mimetype === expectedType;
  }
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= png.length && png.every((value, index) => bytes[index] === value);
  }
  if (["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.oasis.opendocument.spreadsheet"].includes(contentType)) {
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b &&
      bytes[2] === 0x03 && bytes[3] === 0x04;
  }
  if (contentType === "application/vnd.ms-excel") {
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    return bytes.length >= ole.length && ole.every((value, index) => bytes[index] === value);
  }
  if (["text/csv", "text/tab-separated-values"].includes(contentType)) {
    return bytes.length > 0 && !bytes.slice(0, 512).some((value) => value === 0);
  }
  return false;
}

async function findBulkApplication(env, applicationId) {
  return env.DB.prepare(`SELECT * FROM author_applications WHERE id = ? LIMIT 1`)
    .bind(applicationId).first();
}

function bulkMetadata(application) {
  if (!application?.bulk_object_key) return null;
  return {
    kind: "bulk",
    name: application.bulk_original_name,
    contentType: application.bulk_content_type,
    size: application.bulk_size,
    uploadedAt: application.bulk_uploaded_at,
    url: `/api/creator-applications/${application.id}/files/bulk`,
  };
}

async function uploadBulk(request, env, account, applicationId) {
  if (!trustedOrigin(request, env)) return error("Invalid origin.", 403);
  const application = await findBulkApplication(env, applicationId);
  if (!application || application.user_id !== account.profile.user_id) return error("Application not found.", 404);
  if (!["draft", "changes_requested"].includes(application.status)) {
    return error("Files can only be changed while the application is editable.", 409);
  }
  const contentType = (request.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!bulkFile.allowed.has(contentType)) return error("Upload a PDF, XLS, XLSX, ODS, CSV, or TSV catalog file.", 415);
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > bulkFile.maxBytes) return error("File is too large.", 413);
  const originalName = cleanFilename(decodeFilename(request.headers.get("x-file-name") || ""));
  if (!originalName) return error("The original filename is required.", 400);
  let inspected;
  try { inspected = await inspectRequest(request); }
  catch (response) { return response instanceof Response ? response : error("File could not be read.", 400); }
  if (!signatureIsValid(inspected.prefix, contentType)) return error("File contents do not match the selected type.", 415);
  const oldKey = application.bulk_object_key;
  const key = `applications/${applicationId}/bulk/${crypto.randomUUID()}.${extension(contentType)}`;
  let stored;
  try {
    stored = await env.PRIVATE_BOOK_FILES.put(key, inspected.stream, {
      httpMetadata: { contentType, contentDisposition: `attachment; filename="${originalName.replace(/"/g, "")}"` },
      customMetadata: { applicationId, ownerUserId: application.user_id, kind: "bulk" },
    });
    if (!stored || stored.size > bulkFile.maxBytes) {
      await env.PRIVATE_BOOK_FILES.delete(key);
      return error("File is too large.", 413);
    }
    await env.DB.prepare(`UPDATE author_applications SET bulk_object_key = ?, bulk_original_name = ?,
      bulk_content_type = ?, bulk_size = ?, bulk_uploaded_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`)
      .bind(key, originalName, contentType, stored.size, applicationId, application.user_id).run();
  } catch (cause) {
    console.error("Bulk catalog upload failed", cause);
    if (stored) await env.PRIVATE_BOOK_FILES.delete(key);
    return error("File upload failed.", 500);
  }
  if (oldKey && oldKey !== key) await env.PRIVATE_BOOK_FILES.delete(oldKey).catch(() => {});
  return Response.json({ file: bulkMetadata(await findBulkApplication(env, applicationId)) }, { status: 201 });
}

async function serveBulk(request, env, account, applicationId) {
  const application = await findBulkApplication(env, applicationId);
  const isAdmin = account.accountRole === "owner" || account.profile.role === "admin";
  if (!application || (!isAdmin && application.user_id !== account.profile.user_id) || !application.bulk_object_key) {
    return error("File not found.", 404);
  }
  const object = await env.PRIVATE_BOOK_FILES.get(application.bulk_object_key);
  if (!object) return error("File not found.", 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers });
}

async function removeBulk(request, env, account, applicationId) {
  if (!trustedOrigin(request, env)) return error("Invalid origin.", 403);
  const application = await findBulkApplication(env, applicationId);
  if (!application || application.user_id !== account.profile.user_id) return error("Application not found.", 404);
  if (!["draft", "changes_requested"].includes(application.status)) return error("Files cannot currently be removed.", 409);
  if (application.bulk_object_key) await env.PRIVATE_BOOK_FILES.delete(application.bulk_object_key);
  await env.DB.prepare(`UPDATE author_applications SET bulk_object_key = NULL, bulk_original_name = NULL,
    bulk_content_type = NULL, bulk_size = NULL, bulk_uploaded_at = NULL,
    updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`)
    .bind(applicationId, application.user_id).run();
  return new Response(null, { status: 204 });
}

async function inspectRequest(request) {
  if (!request.body) throw error("A file body is required.", 400);
  const reader = request.clone().body.getReader();
  const chunks = [];
  let length = 0;
  while (length < 512) {
    const chunk = await reader.read();
    if (chunk.done) break;
    if (chunk.value?.length) {
      chunks.push(chunk.value);
      length += chunk.value.length;
    }
  }
  await reader.cancel();
  if (!length) throw error("The file is empty.", 400);
  const prefix = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    prefix.set(chunk, offset);
    offset += chunk.length;
  }
  return { prefix, stream: request.body };
}

function clientValidation(request, contentType, kind) {
  const validation = request.headers.get("x-book-file-validated") || "";
  if (kind === "cover") return validation === "image-decoded" ? validation : "";
  if (contentType === "application/pdf") {
    return validation === "pdfjs-first-page" ? validation : "";
  }
  return validation === "epub-container" ? validation : "";
}

async function findBook(env, applicationId) {
  return env.DB.prepare(
    `SELECT b.*, a.user_id, a.status AS application_status
     FROM books b JOIN author_applications a ON a.id = b.application_id
     WHERE a.id = ? LIMIT 1`
  ).bind(applicationId).first();
}

async function findAuthorBook(env, bookId) {
  return env.DB.prepare(
    `SELECT b.*, b.owner_user_id AS user_id, b.status AS application_status
     FROM books b WHERE b.id = ? LIMIT 1`
  ).bind(bookId).first();
}

function fileMetadata(book, kind) {
  const config = fileTypes[kind];
  if (!book?.[config.keyColumn]) return null;
  return {
    kind,
    name: book[config.nameColumn],
    contentType: book[config.typeColumn],
    size: book[config.sizeColumn],
    uploadedAt: book[config.uploadedColumn],
    url: `/api/creator-applications/${book.application_id}/files/${kind}`,
  };
}

function authorFileMetadata(book, kind) {
  const metadata = fileMetadata(book, kind);
  if (metadata) metadata.url = `/api/author/books/${book.id}/files/${kind}`;
  return metadata;
}

async function upload(request, env, account, applicationId, kind) {
  if (!trustedOrigin(request, env)) return error("Invalid origin.", 403);
  const config = fileTypes[kind];
  const book = await findBook(env, applicationId);
  if (!book || book.user_id !== account.profile.user_id) return error("Application not found.", 404);
  if (!["draft", "changes_requested"].includes(book.application_status)) {
    return error("Files can only be changed while the application is editable.", 409);
  }

  const contentType = (request.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!config.allowed.has(contentType)) return error("Unsupported file type.", 415);
  const validation = clientValidation(request, contentType, kind);
  if (!validation) {
    return error(kind === "cover"
      ? "The cover image must be decoded and validated before upload."
      : "The manuscript must be opened and validated before upload.", 422);
  }
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > config.maxBytes) return error("File is too large.", 413);
  const originalName = cleanFilename(
    decodeFilename(request.headers.get("x-file-name") || "")
  );
  if (!originalName) return error("The original filename is required.", 400);

  let inspected;
  try { inspected = await inspectRequest(request); }
  catch (response) { return response instanceof Response ? response : error("File could not be read.", 400); }
  if (!signatureIsValid(inspected.prefix, contentType)) return error("File contents do not match the selected type.", 415);

  const oldKey = book[config.keyColumn];
  const key = `applications/${applicationId}/${kind}/${crypto.randomUUID()}.${extension(contentType)}`;
  let stored;
  try {
    stored = await env.PRIVATE_BOOK_FILES.put(key, inspected.stream, {
      httpMetadata: { contentType, contentDisposition: `inline; filename="${originalName.replace(/"/g, "")}"` },
      customMetadata: { applicationId, bookId: book.id, ownerUserId: book.user_id, kind },
    });
    if (!stored || stored.size > config.maxBytes) {
      await env.PRIVATE_BOOK_FILES.delete(key);
      return error("File is too large.", 413);
    }
    await env.DB.prepare(
      `UPDATE books SET ${config.keyColumn} = ?, ${config.nameColumn} = ?,
       ${config.typeColumn} = ?, ${config.sizeColumn} = ?,
       ${config.uploadedColumn} = CURRENT_TIMESTAMP,
       manuscript_validation = CASE WHEN ? = 'manuscript' THEN ? ELSE manuscript_validation END,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND owner_user_id = ?`
    ).bind(key, originalName, contentType, stored.size, kind, validation, book.id, book.user_id).run();
  } catch (cause) {
    console.error("Private file upload failed", cause);
    if (stored) await env.PRIVATE_BOOK_FILES.delete(key);
    return error("File upload failed.", 500);
  }
  if (oldKey && oldKey !== key) {
    await env.PRIVATE_BOOK_FILES.delete(oldKey).catch((cause) => {
      console.error("Old private file cleanup failed", cause);
    });
  }
  return Response.json({ file: fileMetadata(await findBook(env, applicationId), kind) }, { status: 201 });
}

async function serve(request, env, account, applicationId, kind) {
  const config = fileTypes[kind];
  const book = await findBook(env, applicationId);
  const isAdmin = account.accountRole === "owner" || account.profile.role === "admin";
  if (!book || (!isAdmin && book.user_id !== account.profile.user_id)) return error("File not found.", 404);
  const key = book[config.keyColumn];
  if (!key) return error("File not found.", 404);
  const rangeRequested = request.headers.has("range");
  const object = await env.PRIVATE_BOOK_FILES.get(
    key,
    rangeRequested ? { range: request.headers } : undefined
  );
  if (!object) return error("File not found.", 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  if (rangeRequested && object.range) headers.set("Content-Range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
  return new Response(object.body, { status: rangeRequested ? 206 : 200, headers });
}

async function remove(request, env, account, applicationId, kind) {
  if (!trustedOrigin(request, env)) return error("Invalid origin.", 403);
  const config = fileTypes[kind];
  const book = await findBook(env, applicationId);
  if (!book || book.user_id !== account.profile.user_id) return error("Application not found.", 404);
  if (!["draft", "changes_requested"].includes(book.application_status)) return error("Files cannot currently be removed.", 409);
  const key = book[config.keyColumn];
  if (key) {
    try { await env.PRIVATE_BOOK_FILES.delete(key); }
    catch { return error("The file could not be removed. Try again.", 503); }
  }
  await env.DB.prepare(
    `UPDATE books SET ${config.keyColumn} = NULL, ${config.nameColumn} = NULL,
     ${config.typeColumn} = NULL, ${config.sizeColumn} = NULL,
     ${config.uploadedColumn} = NULL,
     manuscript_validation = CASE WHEN ? = 'manuscript' THEN NULL ELSE manuscript_validation END,
     updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(kind, book.id).run();
  return new Response(null, { status: 204 });
}

export async function handleBookFileRequest(request, env, executionContext) {
  const authorization = await requireRoles(request, env, ["reader", "author", "admin"], executionContext);
  if (authorization.response) return authorization.response;
  const match = new URL(request.url).pathname.match(
    /^\/api\/creator-applications\/([0-9a-f-]+)\/files\/(manuscript|cover|bulk)$/i
  );
  if (!match) return error("Not found.", 404);
  const [, applicationId, rawKind] = match;
  const kind = rawKind.toLowerCase();
  if (kind === "bulk") {
    if (request.method === "PUT") return uploadBulk(request, env, authorization.account, applicationId);
    if (request.method === "GET") return serveBulk(request, env, authorization.account, applicationId);
    if (request.method === "DELETE") return removeBulk(request, env, authorization.account, applicationId);
    return error("Method not allowed.", 405);
  }
  if (request.method === "PUT") return upload(request, env, authorization.account, applicationId, kind);
  if (request.method === "GET") return serve(request, env, authorization.account, applicationId, kind);
  if (request.method === "DELETE") return remove(request, env, authorization.account, applicationId, kind);
  return error("Method not allowed.", 405);
}

async function uploadAuthorFile(request, env, account, bookId, kind) {
  if (!trustedOrigin(request, env)) return error("Invalid origin.", 403);
  const config = fileTypes[kind];
  const book = await findAuthorBook(env, bookId);
  if (!book || book.user_id !== account.profile.user_id) return error("Book not found.", 404);
  if (!["draft", "changes_requested"].includes(book.status)) return error("Files can only be changed while the book is editable.", 409);
  const contentType = (request.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!config.allowed.has(contentType)) return error("Unsupported file type.", 415);
  const validation = clientValidation(request, contentType, kind);
  if (!validation) {
    return error(kind === "cover"
      ? "The cover image must be decoded and validated before upload."
      : "The manuscript must be opened and validated before upload.", 422);
  }
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > config.maxBytes) return error("File is too large.", 413);
  const originalName = cleanFilename(decodeFilename(request.headers.get("x-file-name") || ""));
  if (!originalName) return error("The original filename is required.", 400);
  let inspected;
  try { inspected = await inspectRequest(request); }
  catch (response) { return response instanceof Response ? response : error("File could not be read.", 400); }
  if (!signatureIsValid(inspected.prefix, contentType)) return error("File contents do not match the selected type.", 415);
  const oldKey = book[config.keyColumn];
  const key = `books/${bookId}/${kind}/${crypto.randomUUID()}.${extension(contentType)}`;
  let stored;
  try {
    stored = await env.PRIVATE_BOOK_FILES.put(key, inspected.stream, {
      httpMetadata: { contentType, contentDisposition: `inline; filename="${originalName.replace(/"/g, "")}"` },
      customMetadata: { bookId, ownerUserId: book.user_id, kind },
    });
    if (!stored || stored.size > config.maxBytes) {
      await env.PRIVATE_BOOK_FILES.delete(key);
      return error("File is too large.", 413);
    }
    await env.DB.prepare(`UPDATE books SET ${config.keyColumn} = ?, ${config.nameColumn} = ?,
      ${config.typeColumn} = ?, ${config.sizeColumn} = ?, ${config.uploadedColumn} = CURRENT_TIMESTAMP,
      manuscript_validation = CASE WHEN ? = 'manuscript' THEN ? ELSE manuscript_validation END,
      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ?`)
      .bind(key, originalName, contentType, stored.size, kind, validation, bookId, book.user_id).run();
  } catch (cause) {
    console.error("Private author file upload failed", cause);
    if (stored) await env.PRIVATE_BOOK_FILES.delete(key);
    return error("File upload failed.", 500);
  }
  if (oldKey && oldKey !== key) {
    await env.PRIVATE_BOOK_FILES.delete(oldKey).catch((cause) => {
      console.error("Old private author file cleanup failed", cause);
    });
  }
  return Response.json({ file: authorFileMetadata(await findAuthorBook(env, bookId), kind) }, { status: 201 });
}

async function serveAuthorFile(request, env, account, bookId, kind) {
  const config = fileTypes[kind];
  const book = await findAuthorBook(env, bookId);
  const isAdmin = account.accountRole === "owner" || account.profile.role === "admin";
  if (!book || (!isAdmin && book.user_id !== account.profile.user_id)) return error("File not found.", 404);
  const key = book[config.keyColumn];
  if (!key) return error("File not found.", 404);
  const rangeRequested = request.headers.has("range");
  const object = await env.PRIVATE_BOOK_FILES.get(key, rangeRequested ? { range: request.headers } : undefined);
  if (!object) return error("File not found.", 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  if (rangeRequested && object.range) headers.set("Content-Range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
  return new Response(object.body, { status: rangeRequested ? 206 : 200, headers });
}

async function removeAuthorFile(request, env, account, bookId, kind) {
  if (!trustedOrigin(request, env)) return error("Invalid origin.", 403);
  const config = fileTypes[kind];
  const book = await findAuthorBook(env, bookId);
  if (!book || book.user_id !== account.profile.user_id) return error("Book not found.", 404);
  if (!["draft", "changes_requested"].includes(book.status)) return error("Files cannot currently be removed.", 409);
  const key = book[config.keyColumn];
  if (key) {
    try { await env.PRIVATE_BOOK_FILES.delete(key); }
    catch { return error("The file could not be removed. Try again.", 503); }
  }
  await env.DB.prepare(`UPDATE books SET ${config.keyColumn} = NULL, ${config.nameColumn} = NULL,
    ${config.typeColumn} = NULL, ${config.sizeColumn} = NULL, ${config.uploadedColumn} = NULL,
    manuscript_validation = CASE WHEN ? = 'manuscript' THEN NULL ELSE manuscript_validation END,
    updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ?`)
    .bind(kind, bookId, book.user_id).run();
  return new Response(null, { status: 204 });
}

export async function handleAuthorBookFileRequest(request, env, executionContext) {
  const authorization = await requireRolesOrOwner(request, env, ["author", "admin"], executionContext);
  if (authorization.response) return authorization.response;
  const match = new URL(request.url).pathname.match(/^\/api\/author\/books\/([0-9a-f-]+)\/files\/(manuscript|cover)$/i);
  if (!match) return error("Not found.", 404);
  const [, bookId, rawKind] = match;
  const kind = rawKind.toLowerCase();
  if (request.method === "PUT") return uploadAuthorFile(request, env, authorization.account, bookId, kind);
  if (request.method === "GET") return serveAuthorFile(request, env, authorization.account, bookId, kind);
  if (request.method === "DELETE") return removeAuthorFile(request, env, authorization.account, bookId, kind);
  return error("Method not allowed.", 405);
}

export { fileMetadata };
