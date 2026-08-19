import { requireRoles } from "./authorization.js";
import { queueTransactionalEmail } from "./email.js";

const adminStatuses = new Set(["researching", "contacting", "acquired", "fulfilled", "unavailable", "rejected"]);
const allStatuses = new Set(["pending", ...adminStatuses, "canceled"]);

function error(message, status) { return Response.json({ error: message }, { status }); }

function trustedOrigin(request, env) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const requestOrigin = new URL(request.url).origin;
  const configured = env.BETTER_AUTH_URL ? new URL(env.BETTER_AUTH_URL).origin : requestOrigin;
  return origin === requestOrigin || origin === configured;
}

async function json(request, max = 10000) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw error("JSON is required.", 415);
  const raw = await request.text();
  if (raw.length > max) throw error("Request is too large.", 413);
  try { return JSON.parse(raw || "{}"); } catch { throw error("Invalid JSON.", 400); }
}

function text(value, label, max, required = false) {
  const result = String(value || "").trim();
  if (required && !result) throw error(`${label} is required.`, 400);
  if (result.length > max) throw error(`${label} is too long.`, 400);
  return result;
}

function serialize(row) {
  return {
    id: row.id, title: row.title, author: row.author_name || "Unknown", isbn: row.isbn || "",
    format: row.requested_format, notes: row.notes || "", status: row.status,
    adminMessage: row.admin_message, fulfilledBookId: row.fulfilled_book_id,
    requester: row.email ? { userId: row.user_id, name: row.display_name, email: row.email } : undefined,
    reviewedBy: row.reviewer_name || null, reviewedAt: row.reviewed_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

const baseSelect = `SELECT r.*, p.display_name, u.email, reviewer.display_name AS reviewer_name
  FROM book_requests r JOIN profiles p ON p.user_id = r.user_id
  JOIN "user" u ON u.id = r.user_id
  LEFT JOIN profiles reviewer ON reviewer.user_id = r.reviewed_by`;

async function mine(env, userId, url) {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit")) || 20));
  const offset = (page - 1) * limit;
  const [rows, count] = await Promise.all([
    env.DB.prepare(`${baseSelect} WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT ? OFFSET ?`)
      .bind(userId, limit, offset).all(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM book_requests WHERE user_id = ?").bind(userId).first(),
  ]);
  const total = Number(count?.total || 0);
  return { requests: (rows.results || []).map(serialize), page, limit, total, hasMore: offset + (rows.results || []).length < total };
}

async function create(env, userId, request) {
  let body;
  try { body = await json(request); } catch (response) { return response; }
  let title, author, isbn, notes;
  try {
    title = text(body.title, "Title", 300, true);
    author = text(body.author, "Author", 300);
    isbn = text(body.isbn, "ISBN", 40);
    notes = text(body.notes, "Notes", 2000);
  } catch (response) { return response; }
  const submittedAuthor = author;
  author = author || "Unknown";
  const format = String(body.format || "any");
  if (!["any", "pdf", "epub"].includes(format)) return error("Invalid format.", 400);
  const active = await env.DB.prepare(`SELECT COUNT(*) AS count FROM book_requests
    WHERE user_id = ? AND status IN ('pending','researching','contacting','acquired')`).bind(userId).first();
  if (Number(active?.count || 0) >= 10) return error("You can have up to 10 active requests at a time.", 429);
  const duplicate = await env.DB.prepare(`SELECT id FROM book_requests WHERE user_id = ?
    AND lower(title) = lower(?) AND lower(COALESCE(author_name,'')) = lower(?)
    AND status IN ('pending','researching','contacting','acquired') LIMIT 1`).bind(userId, title, author).first();
  if (duplicate) return error("You already have an active request for this book.", 409);
  const catalog = isbn
    ? await env.DB.prepare("SELECT id FROM books WHERE status = 'approved' AND isbn = ? LIMIT 1").bind(isbn).first()
    : await env.DB.prepare(`SELECT id FROM books WHERE status = 'approved' AND lower(title) = lower(?)
      AND (? = '' OR lower(author_name) = lower(?)) LIMIT 1`).bind(title, submittedAuthor, submittedAuthor).first();
  if (catalog) return error("This book is already available in the catalog.", 409);
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO book_requests
      (id, user_id, title, author_name, isbn, requested_format, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, userId, title, author, isbn || null, format, notes || null),
    env.DB.prepare(`INSERT INTO notifications
      (id, user_id, type, title, message, related_record_type, related_record_id)
      VALUES (?, ?, 'book_request_submitted', 'Book request submitted', ?, 'book_request', ?)`)
      .bind(crypto.randomUUID(), userId, `We received your request for “${title}”.`, id),
  ]);
  const row = await env.DB.prepare(`${baseSelect} WHERE r.id = ?`).bind(id).first();
  return Response.json({ request: serialize(row) }, { status: 201 });
}

async function cancel(env, userId, id) {
  const row = await env.DB.prepare("SELECT * FROM book_requests WHERE id = ? AND user_id = ?").bind(id, userId).first();
  if (!row) return error("Request not found.", 404);
  if (row.status !== "pending") return error("Only a pending request can be canceled.", 409);
  await env.DB.prepare("UPDATE book_requests SET status = 'canceled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?")
    .bind(id, userId).run();
  const updated = await env.DB.prepare(`${baseSelect} WHERE r.id = ?`).bind(id).first();
  return Response.json({ request: serialize(updated) });
}

function adminEmail(row, baseUrl) {
  const actionUrl = new URL("/book-requests.html", baseUrl).toString();
  return {
    type: "book-request-updated", to: row.email,
    subject: `Update on your request for “${row.title}”`,
    heading: "Your book request was updated",
    message: row.admin_message
      ? `Your request for “${row.title}” is now ${row.status}. Message from our team: ${row.admin_message}`
      : `Your request for “${row.title}” is now ${row.status}.`,
    actionLabel: "View your requests", actionUrl,
  };
}

async function adminList(env, url) {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 30));
  const status = String(url.searchParams.get("status") || "");
  const query = String(url.searchParams.get("query") || "").trim().slice(0, 200);
  const clauses = [], binds = [];
  if (status) {
    if (!allStatuses.has(status)) return { response: error("Invalid status.", 400) };
    clauses.push("r.status = ?"); binds.push(status);
  }
  if (query) {
    const like = `%${query}%`;
    clauses.push("(r.title LIKE ? OR r.author_name LIKE ? OR r.isbn LIKE ? OR p.display_name LIKE ? OR u.email LIKE ?)");
    binds.push(like, like, like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const offset = (page - 1) * limit;
  const [rows, count] = await Promise.all([
    env.DB.prepare(`${baseSelect} ${where} ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'researching' THEN 1
      WHEN 'contacting' THEN 2 WHEN 'acquired' THEN 3 ELSE 4 END, r.created_at ASC LIMIT ? OFFSET ?`)
      .bind(...binds, limit, offset).all(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM book_requests r JOIN profiles p ON p.user_id = r.user_id
      JOIN "user" u ON u.id = r.user_id ${where}`).bind(...binds).first(),
  ]);
  const total = Number(count?.total || 0);
  return { data: { requests: (rows.results || []).map(serialize), page, limit, total, hasMore: offset + (rows.results || []).length < total } };
}

async function adminUpdate(request, env, executionContext, adminId, id) {
  let body;
  try { body = await json(request, 5000); } catch (response) { return response; }
  const status = String(body.status || "");
  if (!adminStatuses.has(status)) return error("Invalid status.", 400);
  let message;
  try { message = text(body.message, "Message", 2000); } catch (response) { return response; }
  if (["unavailable", "rejected"].includes(status) && !message) return error("A message is required for this status.", 400);
  const current = await env.DB.prepare(`${baseSelect} WHERE r.id = ?`).bind(id).first();
  if (!current) return error("Request not found.", 404);
  if (["fulfilled", "unavailable", "rejected", "canceled"].includes(current.status)) {
    return error("This request is already closed.", 409);
  }
  let bookId = null;
  if (status === "fulfilled") {
    bookId = String(body.bookId || "").trim().slice(0, 100);
    if (!bookId) return error("An approved catalog book is required to fulfill this request.", 400);
    const book = await env.DB.prepare("SELECT id FROM books WHERE id = ? AND status = 'approved'").bind(bookId).first();
    if (!book) return error("Approved catalog book not found.", 404);
  }
  await env.DB.batch([
    env.DB.prepare(`UPDATE book_requests SET status = ?, admin_message = ?, fulfilled_book_id = ?,
      reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(status, message || null, bookId, adminId, id),
    env.DB.prepare(`INSERT INTO notifications
      (id, user_id, type, title, message, related_record_type, related_record_id)
      VALUES (?, ?, 'book_request_updated', 'Book request updated', ?, 'book_request', ?)`)
      .bind(crypto.randomUUID(), current.user_id,
        message || `Your request for “${current.title}” is now ${status}.`, id),
    env.DB.prepare(`INSERT INTO audit_log
      (id, admin_user_id, action, target_type, target_id, previous_value, new_value)
      VALUES (?, ?, 'book_request.update', 'book_request', ?, ?, ?)`)
      .bind(crypto.randomUUID(), adminId, id,
        JSON.stringify({ status: current.status }), JSON.stringify({ status, message: message || null, bookId })),
  ]);
  const updated = await env.DB.prepare(`${baseSelect} WHERE r.id = ?`).bind(id).first();
  queueTransactionalEmail(executionContext, env, adminEmail(updated, env.BETTER_AUTH_URL || new URL(request.url).origin));
  return Response.json({ request: serialize(updated) });
}

export async function handleBookRequestWorkflow(request, env, executionContext) {
  const url = new URL(request.url);
  const adminRoute = url.pathname.startsWith("/api/admin/book-requests");
  const authorization = await requireRoles(request, env, adminRoute ? ["admin"] : ["reader", "author", "admin"], executionContext);
  if (authorization.response) return authorization.response;
  if (request.method !== "GET" && !trustedOrigin(request, env)) return error("Invalid origin.", 403);
  const userId = authorization.account.profile.user_id;

  if (!adminRoute && url.pathname === "/api/book-requests" && request.method === "GET") return Response.json(await mine(env, userId, url));
  if (!adminRoute && url.pathname === "/api/book-requests" && request.method === "POST") return create(env, userId, request);
  const cancelMatch = url.pathname.match(/^\/api\/book-requests\/([0-9a-f-]+)\/cancel$/i);
  if (!adminRoute && cancelMatch && request.method === "POST") return cancel(env, userId, cancelMatch[1]);

  if (adminRoute && url.pathname === "/api/admin/book-requests" && request.method === "GET") {
    const result = await adminList(env, url);
    return result.response || Response.json(result.data);
  }
  const adminMatch = url.pathname.match(/^\/api\/admin\/book-requests\/([0-9a-f-]+)$/i);
  if (adminRoute && adminMatch && request.method === "PATCH") {
    return adminUpdate(request, env, executionContext, userId, adminMatch[1]);
  }
  return error("Not found.", 404);
}
