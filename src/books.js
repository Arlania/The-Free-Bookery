import { requireRoles } from "./authorization.js";
import {
  doiIsValid,
  findDuplicateBooks,
  isbnIsValid,
  normalizeDoi,
  normalizeIsbn,
} from "./book-metadata.js";

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
    cover_url: row.public_cover_url || (row.cover_object_key
      ? `/api/books/${encodeURIComponent(row.id)}/cover`
      : null),
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
            isbn, doi, public_cover_url, book_object_key, cover_object_key
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
            book_object_key, cover_object_key, cover_content_type,
            cover_original_name
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
  const contentType = book.manuscript_content_type;
  if (!["application/pdf", "application/epub+zip"].includes(contentType)) {
    return error("This book format cannot be opened in the reader.", 415);
  }
  const rangeRequested = request.headers.has("range");
  const object = await env.PRIVATE_BOOK_FILES.get(
    book.book_object_key,
    rangeRequested ? { range: request.headers } : undefined
  );
  if (!object) return error("Book file not found.", 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", `inline; filename="${(book.manuscript_original_name || (contentType === "application/pdf" ? "book.pdf" : "book.epub")).replace(/"/g, "")}"`);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Accept-Ranges", "bytes");
  headers.set("ETag", object.httpEtag);
  if (rangeRequested && object.range) {
    headers.set("Content-Range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
  }
  return new Response(object.body, { status: rangeRequested ? 206 : 200, headers });
}

async function getBookCover(request, env, id) {
  const book = await findApprovedBook(env, id);
  if (!book?.cover_object_key) return error("Book cover not found.", 404);
  const object = await env.PRIVATE_BOOK_FILES.get(book.cover_object_key);
  if (!object) return error("Book cover not found.", 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", book.cover_content_type || "image/jpeg");
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { headers });
}

export async function handleBookRequest(request, env, executionContext) {
  const url = new URL(request.url);
  if (url.pathname === "/api/books/search" && request.method === "GET") {
    return searchBooks(request, env);
  }
  if (url.pathname === "/api/books/duplicate-check" && request.method === "GET") {
    const authorization = await requireRoles(
      request, env, ["reader", "author", "admin"], executionContext
    );
    if (authorization.response) return authorization.response;
    const isbn = String(url.searchParams.get("isbn") || "").trim();
    const doi = String(url.searchParams.get("doi") || "").trim();
    if (!isbnIsValid(isbn)) return error("Enter a valid ISBN-10 or ISBN-13.", 400);
    if (!doiIsValid(doi)) return error("Enter a valid DOI.", 400);
    const matches = await findDuplicateBooks(env, {
      id: String(url.searchParams.get("exclude") || "").slice(0, 100),
      isbn_normalized: normalizeIsbn(isbn) || null,
      doi_normalized: normalizeDoi(doi) || null,
    });
    return Response.json({ hasDuplicates: matches.length > 0, count: matches.length });
  }
  const match = url.pathname.match(/^\/api\/books\/([^/]+)(\/(read|cover))?$/);
  if (!match) return error("Not found.", 404);
  if (request.method !== "GET") return error("Method not allowed.", 405);
  const id = decodeURIComponent(match[1]);
  if (!id || id.length > 100) return error("Book not found.", 404);
  if (match[3] === "read") return readBook(request, env, executionContext, id);
  if (match[3] === "cover") return getBookCover(request, env, id);
  return getBook(env, id);
}
