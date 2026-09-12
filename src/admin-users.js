import { requireOwner } from "./authorization.js";
import { createAuth } from "./auth.js";

function error(message, status) { return Response.json({ error: message }, { status }); }
function trustedOrigin(request, env) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const requestOrigin = new URL(request.url).origin;
  const configured = env.BETTER_AUTH_URL ? new URL(env.BETTER_AUTH_URL).origin : requestOrigin;
  return origin === requestOrigin || origin === configured;
}
async function body(request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw error("JSON is required.", 415);
  try { return await request.json(); } catch { throw error("Invalid JSON.", 400); }
}
function clean(value, max) { return String(value || "").trim().slice(0, max); }
function validRole(value) { return ["reader", "author", "admin"].includes(value); }

async function listUsers(env, url) {
  const query = clean(url.searchParams.get("query"), 200);
  const role = clean(url.searchParams.get("role"), 20).toLowerCase();
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 30));
  const clauses = ["p.deleted_at IS NULL"];
  const bindings = [];
  if (validRole(role)) { clauses.push("p.role = ?"); bindings.push(role); }
  if (query) {
    clauses.push("(p.display_name LIKE ? OR p.user_id LIKE ? OR u.email LIKE ?)");
    const like = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    bindings.push(like, like, like);
  }
  const where = `WHERE ${clauses.join(" AND ")}`;
  const offset = (page - 1) * limit;
  const [rows, count] = await Promise.all([
    env.DB.prepare(`SELECT p.user_id, p.display_name, p.role, p.created_at, p.updated_at,
      u.email, CASE WHEN o.user_id IS NULL THEN 0 ELSE 1 END AS is_owner
      FROM profiles p LEFT JOIN "user" u ON u.id = p.user_id
      LEFT JOIN platform_owners o ON o.user_id = p.user_id
      ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`)
      .bind(...bindings, limit, offset).all(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM profiles p LEFT JOIN "user" u ON u.id = p.user_id ${where}`)
      .bind(...bindings).first(),
  ]);
  const users = rows.results || [];
  if (users.length) {
    const placeholders = users.map(() => "?").join(",");
    const sessions = await env.DB.prepare(`SELECT id, userId, ipAddress, userAgent, createdAt, updatedAt, expiresAt,
      CASE WHEN datetime(expiresAt) > CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS valid_session,
      CASE WHEN datetime(expiresAt) > CURRENT_TIMESTAMP AND datetime(updatedAt) >= datetime('now', '-15 minutes') THEN 1 ELSE 0 END AS active_now
      FROM "session" WHERE userId IN (${placeholders}) ORDER BY updatedAt DESC`)
      .bind(...users.map((user) => user.user_id)).all();
    const byUser = new Map();
    (sessions.results || []).forEach((session) => {
      if (!byUser.has(session.userId)) byUser.set(session.userId, []);
      byUser.get(session.userId).push({ id: session.id, ipAddress: session.ipAddress || "Unavailable",
        userAgent: session.userAgent || "Unknown device", createdAt: session.createdAt,
        lastActiveAt: session.updatedAt, expiresAt: session.expiresAt,
        sessionValid: Boolean(session.valid_session), activeNow: Boolean(session.active_now) });
    });
    users.forEach((user) => { user.sessions = byUser.get(user.user_id) || []; });
  }
  const total = Number(count?.total || 0);
  return { users, page, limit, total, hasMore: offset + users.length < total };
}

export async function handleAdminUsersRequest(request, env, executionContext) {
  const authorization = await requireOwner(request, env, executionContext);
  if (authorization.response) return authorization.response;
  const ownerId = authorization.account.profile.user_id;
  const url = new URL(request.url);
  if (url.pathname === "/api/admin/users" && request.method === "GET") return Response.json(await listUsers(env, url));
  if (!["POST", "PATCH", "DELETE"].includes(request.method)) return error("Method not allowed.", 405);
  if (!trustedOrigin(request, env)) return error("Invalid origin.", 403);

  if (url.pathname === "/api/admin/users" && request.method === "POST") {
    let data; try { data = await body(request); } catch (response) { return response; }
    const name = clean(data.name, 120), email = clean(data.email, 320).toLowerCase();
    const password = String(data.password || ""), role = clean(data.role, 20).toLowerCase();
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !validRole(role)) {
      return error("Enter a name, valid email, password of at least 8 characters, and valid role.", 400);
    }
    const context = await createAuth(env, request.url, executionContext).$context;
    if (await context.internalAdapter.findUserByEmail(email)) return error("An account already uses this email.", 409);
    let user;
    try {
      user = await context.internalAdapter.createUser({ name, email, emailVerified: true });
      const hashedPassword = await context.password.hash(password);
      await context.internalAdapter.linkAccount({ providerId: "credential", issuer: "local:credential",
        accountId: user.id, password: hashedPassword, userId: user.id });
      await env.DB.prepare(`INSERT INTO profiles (user_id, display_name, role) VALUES (?, ?, ?)`)
        .bind(user.id, name, role).run();
      await env.DB.prepare(`INSERT INTO audit_log
        (id, admin_user_id, action, target_type, target_id, new_value)
        VALUES (?, ?, 'user.create', 'user', ?, ?)`)
        .bind(crypto.randomUUID(), ownerId, user.id, JSON.stringify({ name, email, role })).run();
    } catch {
      if (user?.id) await context.internalAdapter.deleteUser(user.id).catch(() => null);
      return error("The account could not be created.", 500);
    }
    return Response.json({ user: { user_id: user.id, display_name: name, email, role, sessions: [] } }, { status: 201 });
  }

  const match = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (!match) return error("Not found.", 404);
  const userId = decodeURIComponent(match[1]);
  const target = await env.DB.prepare(`SELECT p.*, u.email,
    CASE WHEN o.user_id IS NULL THEN 0 ELSE 1 END AS is_owner
    FROM profiles p LEFT JOIN "user" u ON u.id = p.user_id
    LEFT JOIN platform_owners o ON o.user_id = p.user_id WHERE p.user_id = ? AND p.deleted_at IS NULL`)
    .bind(userId).first();
  if (!target) return error("User not found.", 404);
  if (target.is_owner || userId === ownerId) return error("The Owner account cannot be changed or deleted here.", 400);

  if (request.method === "PATCH") {
    let data; try { data = await body(request); } catch (response) { return response; }
    const role = clean(data.role, 20).toLowerCase();
    if (!validRole(role)) return error("Invalid role.", 400);
    await env.DB.batch([
      env.DB.prepare(`UPDATE profiles SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(role, userId),
      env.DB.prepare(`INSERT INTO audit_log
        (id, admin_user_id, action, target_type, target_id, previous_value, new_value)
        VALUES (?, ?, 'user.role_change', 'user', ?, ?, ?)`)
        .bind(crypto.randomUUID(), ownerId, userId, JSON.stringify({ role: target.role }), JSON.stringify({ role })),
    ]);
    return Response.json({ success: true, role });
  }

  const context = await createAuth(env, request.url, executionContext).$context;
  await context.internalAdapter.deleteUserSessions(userId);
  await context.internalAdapter.deleteUser(userId);
  await env.DB.batch([
    env.DB.prepare(`UPDATE profiles SET display_name = 'Deleted user', role = 'reader', deleted_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(userId),
    env.DB.prepare(`UPDATE author_applications SET reviewed_by = NULL WHERE reviewed_by = ?`).bind(userId),
    env.DB.prepare(`UPDATE books SET reviewed_by = NULL WHERE reviewed_by = ?`).bind(userId),
    env.DB.prepare(`UPDATE book_requests SET reviewed_by = NULL WHERE reviewed_by = ?`).bind(userId),
    env.DB.prepare(`INSERT INTO audit_log
      (id, admin_user_id, action, target_type, target_id, previous_value, new_value)
      VALUES (?, ?, 'user.delete', 'user', ?, ?, ?)`)
      .bind(crypto.randomUUID(), ownerId, userId,
        JSON.stringify({ name: target.display_name, email: target.email, role: target.role }), JSON.stringify({ deleted: true })),
  ]);
  return Response.json({ success: true });
}
