import { requireRoles } from "./authorization.js";

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
  try { return JSON.parse(await request.text() || "{}"); }
  catch { throw error("Invalid JSON.", 400); }
}

function serialize(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    relatedRecordType: row.related_record_type,
    relatedRecordId: row.related_record_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

async function list(env, userId, url) {
  const page = Math.max(1, Math.min(100000, Number(url.searchParams.get("page")) || 1));
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit")) || 20));
  const unreadOnly = url.searchParams.get("unread") === "true";
  const offset = (page - 1) * limit;
  const unreadWhere = unreadOnly ? "AND read_at IS NULL" : "";
  const [rows, counts] = await Promise.all([
    env.DB.prepare(`SELECT id, type, title, message, related_record_type,
      related_record_id, read_at, created_at FROM notifications
      WHERE user_id = ? ${unreadWhere}
      ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
      .bind(userId, limit, offset).all(),
    env.DB.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) AS unread
      FROM notifications WHERE user_id = ?`).bind(userId).first(),
  ]);
  const filteredTotal = unreadOnly ? Number(counts?.unread || 0) : Number(counts?.total || 0);
  return {
    notifications: (rows.results || []).map(serialize),
    unreadCount: Number(counts?.unread || 0),
    page,
    limit,
    total: filteredTotal,
    hasMore: offset + (rows.results || []).length < filteredTotal,
  };
}

export async function handleNotificationRequest(request, env, executionContext) {
  const authorization = await requireRoles(
    request, env, ["reader", "author", "admin"], executionContext
  );
  if (authorization.response) return authorization.response;
  const userId = authorization.account.profile.user_id;
  const url = new URL(request.url);

  if (url.pathname === "/api/notifications" && request.method === "GET") {
    return Response.json(await list(env, userId, url));
  }

  if (request.method !== "PATCH" && request.method !== "POST") {
    return error("Method not allowed.", 405);
  }
  if (!trustedOrigin(request, env)) return error("Invalid origin.", 403);

  if (url.pathname === "/api/notifications/read-all" && request.method === "POST") {
    await env.DB.prepare(`UPDATE notifications SET read_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND read_at IS NULL`).bind(userId).run();
    return Response.json({ unreadCount: 0 });
  }

  const match = url.pathname.match(/^\/api\/notifications\/([0-9a-f-]+)$/i);
  if (!match || request.method !== "PATCH") return error("Not found.", 404);
  let body;
  try { body = await readJson(request); }
  catch (response) { return response instanceof Response ? response : error("Invalid request.", 400); }
  if (typeof body.read !== "boolean") return error("read must be true or false.", 400);
  const result = await env.DB.prepare(`UPDATE notifications
    SET read_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END
    WHERE id = ? AND user_id = ?`).bind(body.read ? 1 : 0, match[1], userId).run();
  if (!result.meta?.changes) return error("Notification not found.", 404);
  const row = await env.DB.prepare(`SELECT id, type, title, message,
    related_record_type, related_record_id, read_at, created_at
    FROM notifications WHERE id = ? AND user_id = ?`).bind(match[1], userId).first();
  return Response.json({ notification: serialize(row) });
}
