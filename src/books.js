import { requireRoles } from "./authorization.js";

function error(message, status) {
  return Response.json({ error: message }, { status });
}

function serializeBook(row) {
  return {
    id: row.id,
    title: row.title,
    author: row.author_name,
    description: row.description || "",
    format: row.manuscript_content_type === "application/epub+zip" ? "epub" : "pdf",
    isbn: row.isbn,
    doi: row.doi,
    cover_url: row.public_cover_url,
    has_file: row.book_object_key ? 1 : 0,
  };
}

async function searchBooks(request, env) {
  const query = String(new URL(request.url).searchParams.get("q") || "").trim();
  if (!query) return Response.json([]);
  if (query.length > 200) return error("Search query is too long.", 400);
  const value = `%${query}%`;
  const result = await env.DB.prepare(
    `SELECT id, title, author_name, description, manuscript_content_type,
            isbn, doi, public_cover_url, book_object_key
     FROM books
     WHERE status = 'approved'
       AND (title LIKE ? OR author_name LIKE ? OR isbn LIKE ? OR doi LIKE ?)
     ORDER BY title COLLATE NOCASE
     LIMIT 50`
  ).bind(value, value, value, value).all();
  return Response.json((result.results || []).map(serializeBook));
}

async function findApprovedBook(env, id) {
  return env.DB.prepare(
    `SELECT id, title, author_name, description, manuscript_content_type,
            manuscript_original_name, isbn, doi, public_cover_url,
            book_object_key
     FROM books WHERE id = ? AND status = 'approved' LIMIT 1`
  ).bind(id).first();
}

async function getBook(env, id) {
  const book = await findApprovedBook(env, id);
  return book ? Response.json(serializeBook(book)) : error("Book not found.", 404);
}

async function readBook(request, env, executionContext, id) {
  const authorization = await requireRoles(
    request, env, ["reader", "author", "admin"], executionContext
  );
  if (authorization.response) return authorization.response;
  const book = await findApprovedBook(env, id);
  if (!book?.book_object_key) return error("Book file not found.", 404);
  if (book.manuscript_content_type !== "application/pdf") {
    return error("This file cannot be opened in the PDF reader.", 415);
  }
  const rangeRequested = request.headers.has("range");
  const object = await env.PRIVATE_BOOK_FILES.get(
    book.book_object_key,
    rangeRequested ? { range: request.headers } : undefined
  );
  if (!object) return error("Book file not found.", 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", `inline; filename="${(book.manuscript_original_name || "book.pdf").replace(/"/g, "")}"`);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Accept-Ranges", "bytes");
  headers.set("ETag", object.httpEtag);
  if (rangeRequested && object.range) {
    headers.set("Content-Range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
  }
  return new Response(object.body, { status: rangeRequested ? 206 : 200, headers });
}

export async function handleBookRequest(request, env, executionContext) {
  const url = new URL(request.url);
  if (url.pathname === "/api/books/search" && request.method === "GET") {
    return searchBooks(request, env);
  }
  const match = url.pathname.match(/^\/api\/books\/([^/]+)(\/read)?$/);
  if (!match) return error("Not found.", 404);
  if (request.method !== "GET") return error("Method not allowed.", 405);
  const id = decodeURIComponent(match[1]);
  if (!id || id.length > 100) return error("Book not found.", 404);
  return match[2]
    ? readBook(request, env, executionContext, id)
    : getBook(env, id);
}
