import { requireRoles } from "./authorization.js";

const editableStatuses = new Set(["draft", "changes_requested"]);
const limits = {
  title: 300, subtitle: 300, language: 80, isbn: 40, doi: 160,
  series: 200, edition: 80, author: 300, contributors: 1000,
  description: 4000, categories: 500, keywords: 1000, readingAge: 100,
  territories: 200, accessibility: 1000,
};

function error(message, status) {
  return Response.json({ error: message }, { status });
}

function trustedOrigin(request, env) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = env.BETTER_AUTH_URL
    ? new URL(env.BETTER_AUTH_URL).origin
    : requestOrigin;
  return origin === requestOrigin || origin === configuredOrigin;
}

async function readJson(request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw error("JSON is required.", 415);
  }
  const raw = await request.text();
  if (raw.length > 30000) throw error("Request is too large.", 413);
  try { return JSON.parse(raw || "{}"); }
  catch { throw error("Invalid JSON.", 400); }
}

function clean(value, field) {
  const text = String(value ?? "").trim();
  if (text.length > limits[field]) throw error(`${field} is too long.`, 400);
  return text;
}

function normalize(body) {
  const book = body?.book || body || {};
  return {
    title: clean(book.title, "title"), subtitle: clean(book.subtitle, "subtitle"),
    language: clean(book.language || "English", "language"),
    isbn: clean(book.isbn, "isbn"), doi: clean(book.doi, "doi"),
    series: clean(book.series, "series"), edition: clean(book.edition, "edition"),
    author: clean(book.author, "author"), contributors: clean(book.contributors, "contributors"),
    description: clean(book.description, "description"),
    categories: clean(book.categories, "categories"), keywords: clean(book.keywords, "keywords"),
    readingAge: clean(book.readingAge, "readingAge"), explicit: book.explicit === true,
    territories: clean(book.territories || "Worldwide", "territories"),
    accessibility: clean(book.accessibility, "accessibility"),
    rightsConfirmation: book.rightsConfirmation === true,
  };
}

const select = `SELECT id, owner_user_id, title, subtitle, language, isbn, doi,
 series_name, edition, author_name, contributors, description, categories,
 keywords, reading_age, explicit_content, territories, accessibility_notes,
 rights_statement, status, submitted_at, reviewed_at, admin_message,
 book_object_key, manuscript_original_name, manuscript_content_type,
 manuscript_size, manuscript_uploaded_at, cover_object_key,
 cover_original_name, cover_content_type, cover_size, cover_uploaded_at,
 created_at, updated_at FROM books`;

async function findBook(env, userId, id) {
  return env.DB.prepare(`${select} WHERE id = ? AND owner_user_id = ? AND application_id IS NULL LIMIT 1`)
    .bind(id, userId).first();
}

function serialize(row) {
  if (!row) return null;
  const file = (kind) => {
    const manuscript = kind === "manuscript";
    const key = manuscript ? row.book_object_key : row.cover_object_key;
    if (!key) return null;
    return {
      name: manuscript ? row.manuscript_original_name : row.cover_original_name,
      contentType: manuscript ? row.manuscript_content_type : row.cover_content_type,
      size: manuscript ? row.manuscript_size : row.cover_size,
      uploadedAt: manuscript ? row.manuscript_uploaded_at : row.cover_uploaded_at,
      url: `/api/author/books/${row.id}/files/${kind}`,
    };
  };
  return {
    id: row.id, status: row.status, title: row.title || "", subtitle: row.subtitle || "",
    language: row.language || "English", isbn: row.isbn || "", doi: row.doi || "",
    series: row.series_name || "", edition: row.edition || "", author: row.author_name || "",
    contributors: row.contributors || "", description: row.description || "",
    categories: row.categories || "", keywords: row.keywords || "",
    readingAge: row.reading_age || "", explicit: row.explicit_content === 1,
    territories: row.territories || "Worldwide", accessibility: row.accessibility_notes || "",
    rightsConfirmation: Boolean(row.rights_statement), adminMessage: row.admin_message,
    submittedAt: row.submitted_at, reviewedAt: row.reviewed_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
    manuscript: file("manuscript"), cover: file("cover"),
  };
}

async function list(env, userId) {
  const result = await env.DB.prepare(
    `${select} WHERE owner_user_id = ? AND application_id IS NULL ORDER BY created_at DESC`
  ).bind(userId).all();
  return (result.results || []).map(serialize);
}

async function create(env, userId) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO books (id, owner_user_id, title, author_name, status)
     VALUES (?, ?, '', '', 'draft')`
  ).bind(id, userId).run();
  return findBook(env, userId, id);
}

async function update(env, userId, id, book) {
  const current = await findBook(env, userId, id);
  if (!current) return { response: error("Book not found.", 404) };
  if (!editableStatuses.has(current.status)) {
    return { response: error("This book cannot currently be edited.", 409) };
  }
  await env.DB.prepare(`UPDATE books SET title = ?, subtitle = ?, language = ?, isbn = ?, doi = ?,
    series_name = ?, edition = ?, author_name = ?, contributors = ?, description = ?,
    categories = ?, keywords = ?, reading_age = ?, explicit_content = ?, territories = ?,
    accessibility_notes = ?, rights_statement = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND owner_user_id = ? AND application_id IS NULL`)
    .bind(book.title, book.subtitle, book.language, book.isbn, book.doi, book.series,
      book.edition, book.author, book.contributors, book.description, book.categories,
      book.keywords, book.readingAge, book.explicit ? 1 : 0, book.territories,
      book.accessibility, book.rightsConfirmation ? "Confirmed by author" : "", id, userId).run();
  return { row: await findBook(env, userId, id) };
}

function missingForSubmission(row) {
  const missing = [];
  if (!row.title) missing.push("book title");
  if (!row.author_name) missing.push("primary author");
  if (!row.description) missing.push("description");
  if (!row.categories) missing.push("categories");
  if (!row.rights_statement) missing.push("rights confirmation");
  if (!row.book_object_key) missing.push("book file");
  if (!row.cover_object_key) missing.push("cover image");
  return missing;
}

async function submit(env, userId, id) {
  const current = await findBook(env, userId, id);
  if (!current) return { response: error("Book not found.", 404) };
  if (!editableStatuses.has(current.status)) {
    return { response: error("This book cannot currently be submitted.", 409) };
  }
  const missing = missingForSubmission(current);
  if (missing.length) return { response: error(`Complete these fields: ${missing.join(", ")}.`, 400) };
  await env.DB.batch([
    env.DB.prepare(`UPDATE books SET status = 'pending', submitted_at = CURRENT_TIMESTAMP,
      reviewed_at = NULL, reviewed_by = NULL, admin_message = NULL,
      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ?`)
      .bind(id, userId),
    env.DB.prepare(`INSERT INTO notifications
      (id, user_id, type, title, message, related_record_type, related_record_id)
      VALUES (?, ?, 'book_submitted', 'Book submitted', ?, 'book', ?)`)
      .bind(crypto.randomUUID(), userId, `“${current.title}” is waiting for Admin review.`, id),
  ]);
  return { row: await findBook(env, userId, id) };
}

async function remove(env, userId, id) {
  const current = await findBook(env, userId, id);
  if (!current) return { response: error("Book not found.", 404) };
  if (!["draft", "changes_requested", "rejected"].includes(current.status)) {
    return { response: error("Only editable or rejected books can be deleted.", 409) };
  }
  await env.DB.prepare(`DELETE FROM books WHERE id = ? AND owner_user_id = ? AND application_id IS NULL`)
    .bind(id, userId).run();
  const keys = [current.book_object_key, current.cover_object_key].filter(Boolean);
  if (keys.length) await env.PRIVATE_BOOK_FILES.delete(keys);
  return { deleted: true };
}

async function changeAvailability(env, userId, id, action) {
  const current = await findBook(env, userId, id);
  if (!current) return { response: error("Book not found.", 404) };
  const allowed = action === "withdraw" ? current.status === "pending" : current.status === "approved";
  if (!allowed) {
    return { response: error(action === "withdraw"
      ? "Only a pending book can be withdrawn."
      : "Only a live book can be unpublished.", 409) };
  }
  const nextStatus = action === "withdraw" ? "draft" : "unpublished";
  await env.DB.batch([
    env.DB.prepare(`UPDATE books SET status = ?, submitted_at = CASE WHEN ? = 'draft' THEN NULL ELSE submitted_at END,
      admin_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ?`)
      .bind(nextStatus, nextStatus, id, userId),
    env.DB.prepare(`INSERT INTO audit_log
      (id, admin_user_id, action, target_type, target_id, previous_value, new_value)
      VALUES (?, ?, ?, 'book', ?, ?, ?)`)
      .bind(crypto.randomUUID(), userId, `book.${action}`, id,
        JSON.stringify({ status: current.status }), JSON.stringify({ status: nextStatus })),
  ]);
  return { row: await findBook(env, userId, id) };
}

export async function handleAuthorBookRequest(request, env, executionContext) {
  const authorization = await requireRoles(request, env, ["author", "admin"], executionContext);
  if (authorization.response) return authorization.response;
  const userId = authorization.account.profile.user_id;
  const url = new URL(request.url);

  if (url.pathname === "/api/author/books" && request.method === "GET") {
    return Response.json({ books: await list(env, userId) });
  }
  if (url.pathname === "/api/author/books" && request.method === "POST") {
    if (!trustedOrigin(request, env)) return error("Invalid origin.", 403);
    return Response.json({ book: serialize(await create(env, userId)) }, { status: 201 });
  }

  const match = url.pathname.match(/^\/api\/author\/books\/([0-9a-f-]+)(\/(submit|withdraw|unpublish))?$/i);
  if (!match) return error("Not found.", 404);
  const id = match[1];
  if (request.method !== "GET" && !trustedOrigin(request, env)) return error("Invalid origin.", 403);
  if (!match[2] && request.method === "GET") {
    const row = await findBook(env, userId, id);
    return row ? Response.json({ book: serialize(row) }) : error("Book not found.", 404);
  }
  if (!match[2] && request.method === "PATCH") {
    let body;
    try { body = normalize(await readJson(request)); }
    catch (response) { return response instanceof Response ? response : error("Invalid request.", 400); }
    const result = await update(env, userId, id, body);
    return result.response || Response.json({ book: serialize(result.row) });
  }
  if (!match[2] && request.method === "DELETE") {
    const result = await remove(env, userId, id);
    return result.response || new Response(null, { status: 204 });
  }
  if (match[2] && request.method === "POST") {
    const action = match[3];
    const result = action === "submit"
      ? await submit(env, userId, id)
      : await changeAvailability(env, userId, id, action);
    return result.response || Response.json({ book: serialize(result.row) });
  }
  return error("Method not allowed.", 405);
}
