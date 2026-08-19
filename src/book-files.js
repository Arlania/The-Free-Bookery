import { requireRoles } from "./authorization.js";

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
  }[contentType];
}

function signatureIsValid(bytes, contentType) {
  if (contentType === "application/pdf") {
    return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  }
  if (contentType === "application/epub+zip") {
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b &&
      bytes[2] === 0x03 && bytes[3] === 0x04;
  }
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= png.length && png.every((value, index) => bytes[index] === value);
  }
  return false;
}

async function inspectRequest(request) {
  if (!request.body) throw error("A file body is required.", 400);
  const reader = request.clone().body.getReader();
  const first = await reader.read();
  if (first.done || !first.value?.length) throw error("The file is empty.", 400);
  await reader.cancel();
  return { prefix: first.value, stream: request.body };
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
     FROM books b WHERE b.id = ? AND b.application_id IS NULL LIMIT 1`
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
       ${config.uploadedColumn} = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND owner_user_id = ?`
    ).bind(key, originalName, contentType, stored.size, book.id, book.user_id).run();
  } catch (cause) {
    console.error("Private file upload failed", cause);
    if (stored) await env.PRIVATE_BOOK_FILES.delete(key);
    return error("File upload failed.", 500);
  }
  if (oldKey && oldKey !== key) await env.PRIVATE_BOOK_FILES.delete(oldKey);
  return Response.json({ file: fileMetadata(await findBook(env, applicationId), kind) }, { status: 201 });
}

async function serve(request, env, account, applicationId, kind) {
  const config = fileTypes[kind];
  const book = await findBook(env, applicationId);
  const isAdmin = account.profile.role === "admin";
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
  await env.DB.prepare(
    `UPDATE books SET ${config.keyColumn} = NULL, ${config.nameColumn} = NULL,
     ${config.typeColumn} = NULL, ${config.sizeColumn} = NULL,
     ${config.uploadedColumn} = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(book.id).run();
  if (key) await env.PRIVATE_BOOK_FILES.delete(key);
  return new Response(null, { status: 204 });
}

export async function handleBookFileRequest(request, env, executionContext) {
  const authorization = await requireRoles(request, env, ["reader", "author", "admin"], executionContext);
  if (authorization.response) return authorization.response;
  const match = new URL(request.url).pathname.match(
    /^\/api\/creator-applications\/([0-9a-f-]+)\/files\/(manuscript|cover)$/i
  );
  if (!match) return error("Not found.", 404);
  const [, applicationId, rawKind] = match;
  const kind = rawKind.toLowerCase();
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
      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND application_id IS NULL`)
      .bind(key, originalName, contentType, stored.size, bookId, book.user_id).run();
  } catch (cause) {
    console.error("Private author file upload failed", cause);
    if (stored) await env.PRIVATE_BOOK_FILES.delete(key);
    return error("File upload failed.", 500);
  }
  if (oldKey && oldKey !== key) await env.PRIVATE_BOOK_FILES.delete(oldKey);
  return Response.json({ file: authorFileMetadata(await findAuthorBook(env, bookId), kind) }, { status: 201 });
}

async function serveAuthorFile(request, env, account, bookId, kind) {
  const config = fileTypes[kind];
  const book = await findAuthorBook(env, bookId);
  const isAdmin = account.profile.role === "admin";
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
  await env.DB.prepare(`UPDATE books SET ${config.keyColumn} = NULL, ${config.nameColumn} = NULL,
    ${config.typeColumn} = NULL, ${config.sizeColumn} = NULL, ${config.uploadedColumn} = NULL,
    updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND application_id IS NULL`)
    .bind(bookId, book.user_id).run();
  if (key) await env.PRIVATE_BOOK_FILES.delete(key);
  return new Response(null, { status: 204 });
}

export async function handleAuthorBookFileRequest(request, env, executionContext) {
  const authorization = await requireRoles(request, env, ["author", "admin"], executionContext);
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
