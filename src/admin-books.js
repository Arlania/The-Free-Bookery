import { requireRolesOrOwner } from "./authorization.js";
import { findDuplicateBooks, storedBookFilesExist } from "./book-metadata.js";

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

async function publishBook(request, env, account, bookId) {
  if (!trustedOrigin(request, env)) return error("Invalid origin.", 403);

  const book = await env.DB.prepare(
    `SELECT id, owner_user_id, title, author_name, description, categories,
            rights_statement, rights_basis, isbn, doi, isbn_normalized,
            doi_normalized, manuscript_validation, book_object_key,
            cover_object_key, status
     FROM books
     WHERE id = ? AND owner_user_id = ? AND application_id IS NULL
     LIMIT 1`
  ).bind(bookId, account.profile.user_id).first();

  if (!book) return error("Book draft not found.", 404);
  if (!["draft", "changes_requested"].includes(book.status)) {
    return error("Only an editable book draft can be published.", 409);
  }

  const missing = [];
  if (!book.title) missing.push("book title");
  if (!book.author_name) missing.push("author");
  if (!book.description) missing.push("description");
  if (!book.categories) missing.push("genre/category");
  if (!book.rights_statement || !book.rights_basis) missing.push("rights confirmation");
  if (!book.book_object_key) missing.push("book file");
  if (book.book_object_key && !book.manuscript_validation) missing.push("validated book file");
  if (!book.cover_object_key) missing.push("cover image");
  if (missing.length) return error(`Complete these fields: ${missing.join(", ")}.`, 400);
  if (!await storedBookFilesExist(env, book)) {
    return error("The uploaded manuscript or cover is missing. Upload it again before publishing.", 409);
  }

  const duplicates = await findDuplicateBooks(env, book);
  let confirmation = false;
  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      const raw = await request.text();
      if (raw.length > 2000) return error("Request is too large.", 413);
      confirmation = JSON.parse(raw || "{}").confirmDuplicate === true;
    } catch {
      return error("Invalid JSON.", 400);
    }
  }
  if (duplicates.length && !confirmation) {
    return Response.json({
      error: "Confirm the matching ISBN or DOI before publishing.",
      code: "DUPLICATE_CONFIRMATION_REQUIRED",
      duplicates: duplicates.map((item) => ({
        id: item.id,
        title: item.title,
        author: item.author_name,
        isbn: item.isbn,
        doi: item.doi,
        status: item.status,
      })),
    }, { status: 409 });
  }

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE books SET status = 'approved', submitted_at = CURRENT_TIMESTAMP,
       reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, admin_message = NULL,
       updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ?`
    ).bind(account.profile.user_id, bookId, account.profile.user_id),
    env.DB.prepare(
      `INSERT INTO audit_log
       (id, admin_user_id, action, target_type, target_id, previous_value, new_value)
       VALUES (?, ?, 'book.admin_upload', 'book', ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      account.profile.user_id,
      bookId,
      JSON.stringify({ status: book.status }),
      JSON.stringify({ status: "approved" })
    ),
  ]);

  return Response.json({
    book: { id: bookId, title: book.title, status: "approved" },
  });
}

export async function handleAdminBookRequest(request, env, executionContext) {
  const authorization = await requireRolesOrOwner(
    request,
    env,
    ["admin"],
    executionContext
  );
  if (authorization.response) return authorization.response;

  const match = new URL(request.url).pathname.match(
    /^\/api\/admin\/books\/([0-9a-f-]+)\/publish$/i
  );
  if (!match) return error("Not found.", 404);
  if (request.method !== "POST") return error("Method not allowed.", 405);
  return publishBook(request, env, authorization.account, match[1]);
}
