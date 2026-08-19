import { requireRoles } from "./authorization.js";

function safeJson(value) {
  if (!value) return null;
  try { return JSON.parse(value); }
  catch { return value; }
}

function cleanFilter(value, max = 100) {
  return String(value || "").trim().slice(0, max);
}

export async function handleAdminActivityRequest(request, env, executionContext) {
  const authorization = await requireRoles(request, env, ["admin"], executionContext);
  if (authorization.response) return authorization.response;
  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Math.min(100000, Number(url.searchParams.get("page")) || 1));
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 30));
  const action = cleanFilter(url.searchParams.get("action"));
  const targetType = cleanFilter(url.searchParams.get("targetType"));
  const query = cleanFilter(url.searchParams.get("query"), 200);
  const clauses = [];
  const bindings = [];
  if (action) { clauses.push("l.action = ?"); bindings.push(action); }
  if (targetType) { clauses.push("l.target_type = ?"); bindings.push(targetType); }
  if (query) {
    clauses.push("(l.action LIKE ? OR l.target_type LIKE ? OR l.target_id LIKE ? OR p.display_name LIKE ?)");
    const like = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    bindings.push(like, like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const offset = (page - 1) * limit;
  const [rows, count, facets] = await Promise.all([
    env.DB.prepare(`SELECT l.id, l.admin_user_id, p.display_name AS actor_name,
      l.action, l.target_type, l.target_id, l.previous_value, l.new_value,
      l.created_at FROM audit_log l
      LEFT JOIN profiles p ON p.user_id = l.admin_user_id
      ${where} ORDER BY l.created_at DESC, l.id DESC LIMIT ? OFFSET ?`)
      .bind(...bindings, limit, offset).all(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM audit_log l
      LEFT JOIN profiles p ON p.user_id = l.admin_user_id ${where}`)
      .bind(...bindings).first(),
    env.DB.prepare(`SELECT GROUP_CONCAT(DISTINCT action) AS actions,
      GROUP_CONCAT(DISTINCT target_type) AS target_types FROM audit_log`).first(),
  ]);
  const total = Number(count?.total || 0);
  return Response.json({
    activity: (rows.results || []).map((row) => ({
      id: row.id, actorUserId: row.admin_user_id,
      actorName: row.actor_name || "Unknown account", action: row.action,
      targetType: row.target_type, targetId: row.target_id,
      previousValue: safeJson(row.previous_value), newValue: safeJson(row.new_value),
      createdAt: row.created_at,
    })),
    filters: {
      actions: facets?.actions ? facets.actions.split(",").sort() : [],
      targetTypes: facets?.target_types ? facets.target_types.split(",").sort() : [],
    },
    page, limit, total, hasMore: offset + (rows.results || []).length < total,
  });
}
