import { requireRoles } from "./authorization.js";

function error(message, status) {
  return Response.json({ error: message }, { status });
}

function trustedOrigin(request, env) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = env.BETTER_AUTH_URL ? new URL(env.BETTER_AUTH_URL).origin : requestOrigin;
  return origin === requestOrigin || origin === configuredOrigin;
}

async function readJson(request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw error("JSON is required.", 415);
  const raw = await request.text();
  if (raw.length > 2000) throw error("Request is too large.", 413);
  try { return JSON.parse(raw || "{}"); }
  catch { throw error("Invalid JSON.", 400); }
}

function cleanName(value) {
  const name = String(value || "").trim();
  if (!name) throw error("Collection name is required.", 400);
  if (name.length > 120) throw error("Collection name is too long.", 400);
  return name;
}

function serializeBook(row) {
  return {
    id: row.id, title: row.title, author: row.author_name,
    description: row.description || "", cover_url: row.public_cover_url,
    has_file: row.status === "approved" && row.book_object_key ? 1 : 0,
    status: row.status,
  };
}

async function approvedBook(env, id) {
  return env.DB.prepare("SELECT id FROM books WHERE id = ? AND status = 'approved' LIMIT 1").bind(id).first();
}

async function ownedCollection(env, userId, id) {
  return env.DB.prepare(`SELECT id, name, created_at, updated_at FROM reader_collections
    WHERE id = ? AND user_id = ? LIMIT 1`).bind(id, userId).first();
}

async function collectionBooks(env, collectionId) {
  const result = await env.DB.prepare(`SELECT b.id, b.title, b.author_name, b.description,
    b.public_cover_url, b.book_object_key, b.status
    FROM reader_collection_books cb JOIN books b ON b.id = cb.book_id
    WHERE cb.collection_id = ? ORDER BY cb.added_at DESC`).bind(collectionId).all();
  return (result.results || []).map(serializeBook);
}

async function serializeCollection(env, row, includeBooks = true) {
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM reader_collection_books WHERE collection_id = ?")
    .bind(row.id).first();
  return {
    id: row.id, name: row.name, bookCount: Number(count?.count || 0),
    books: includeBooks ? await collectionBooks(env, row.id) : undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

async function listCollections(env, userId) {
  const rows = await env.DB.prepare(`SELECT id, name, created_at, updated_at
    FROM reader_collections WHERE user_id = ? ORDER BY updated_at DESC, name COLLATE NOCASE`)
    .bind(userId).all();
  return Promise.all((rows.results || []).map((row) => serializeCollection(env, row)));
}

async function listStarred(env, userId) {
  const result = await env.DB.prepare(`SELECT b.id, b.title, b.author_name, b.description,
    b.public_cover_url, b.book_object_key, b.status
    FROM reader_starred_books s JOIN books b ON b.id = s.book_id
    WHERE s.user_id = ? ORDER BY s.starred_at DESC`).bind(userId).all();
  return (result.results || []).map(serializeBook);
}

async function createCollection(env, userId, request) {
  let name;
  try { name = cleanName((await readJson(request)).name); }
  catch (response) { return response instanceof Response ? response : error("Invalid request.", 400); }
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare("INSERT INTO reader_collections (id, user_id, name) VALUES (?, ?, ?)")
      .bind(id, userId, name).run();
  } catch (cause) {
    if (String(cause).includes("UNIQUE")) return error("A collection with this name already exists.", 409);
    throw cause;
  }
  return Response.json({ collection: await serializeCollection(env, await ownedCollection(env, userId, id)) }, { status: 201 });
}

async function renameCollection(env, userId, id, request) {
  if (!await ownedCollection(env, userId, id)) return error("Collection not found.", 404);
  let name;
  try { name = cleanName((await readJson(request)).name); }
  catch (response) { return response instanceof Response ? response : error("Invalid request.", 400); }
  try {
    await env.DB.prepare(`UPDATE reader_collections SET name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?`).bind(name, id, userId).run();
  } catch (cause) {
    if (String(cause).includes("UNIQUE")) return error("A collection with this name already exists.", 409);
    throw cause;
  }
  return Response.json({ collection: await serializeCollection(env, await ownedCollection(env, userId, id)) });
}

export async function handleReaderLibraryRequest(request, env, executionContext) {
  const authorization = await requireRoles(request, env, ["reader", "author", "admin"], executionContext);
  if (authorization.response) return authorization.response;
  const userId = authorization.account.profile.user_id;
  const url = new URL(request.url);
  const mutation = request.method !== "GET";
  if (mutation && !trustedOrigin(request, env)) return error("Invalid origin.", 403);

  if (url.pathname === "/api/collections" && request.method === "GET") {
    return Response.json({ collections: await listCollections(env, userId) });
  }
  if (url.pathname === "/api/collections" && request.method === "POST") {
    return createCollection(env, userId, request);
  }
  if (url.pathname === "/api/starred" && request.method === "GET") {
    return Response.json({ books: await listStarred(env, userId) });
  }

  const starred = url.pathname.match(/^\/api\/starred\/([^/]+)$/);
  if (starred && ["PUT", "DELETE"].includes(request.method)) {
    const bookId = decodeURIComponent(starred[1]).slice(0, 100);
    if (request.method === "PUT") {
      if (!await approvedBook(env, bookId)) return error("Book not found.", 404);
      await env.DB.prepare(`INSERT OR IGNORE INTO reader_starred_books (user_id, book_id) VALUES (?, ?)`)
        .bind(userId, bookId).run();
      return Response.json({ starred: true });
    }
    await env.DB.prepare("DELETE FROM reader_starred_books WHERE user_id = ? AND book_id = ?")
      .bind(userId, bookId).run();
    return Response.json({ starred: false });
  }

  const bookMatch = url.pathname.match(/^\/api\/collections\/([0-9a-f-]+)\/books\/([^/]+)$/i);
  if (bookMatch && ["PUT", "DELETE"].includes(request.method)) {
    const collectionId = bookMatch[1];
    const bookId = decodeURIComponent(bookMatch[2]).slice(0, 100);
    const collection = await ownedCollection(env, userId, collectionId);
    if (!collection) return error("Collection not found.", 404);
    if (request.method === "PUT") {
      if (!await approvedBook(env, bookId)) return error("Book not found.", 404);
      const result = await env.DB.prepare(`INSERT OR IGNORE INTO reader_collection_books
        (collection_id, book_id) VALUES (?, ?)`).bind(collectionId, bookId).run();
      await env.DB.prepare("UPDATE reader_collections SET updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(collectionId).run();
      return Response.json({ added: Boolean(result.meta?.changes) });
    }
    await env.DB.prepare("DELETE FROM reader_collection_books WHERE collection_id = ? AND book_id = ?")
      .bind(collectionId, bookId).run();
    return new Response(null, { status: 204 });
  }

  const collectionMatch = url.pathname.match(/^\/api\/collections\/([0-9a-f-]+)$/i);
  if (!collectionMatch) return error("Not found.", 404);
  const id = collectionMatch[1];
  if (request.method === "GET") {
    const row = await ownedCollection(env, userId, id);
    return row ? Response.json({ collection: await serializeCollection(env, row) }) : error("Collection not found.", 404);
  }
  if (request.method === "PATCH") return renameCollection(env, userId, id, request);
  if (request.method === "DELETE") {
    const result = await env.DB.prepare("DELETE FROM reader_collections WHERE id = ? AND user_id = ?")
      .bind(id, userId).run();
    return result.meta?.changes ? new Response(null, { status: 204 }) : error("Collection not found.", 404);
  }
  return error("Method not allowed.", 405);
}
