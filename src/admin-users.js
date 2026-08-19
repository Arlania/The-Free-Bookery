import { requireRoles } from "./authorization.js";

export async function handleAdminUsersRequest(request, env, executionContext) {
  const authorization = await requireRoles(request, env, ["admin"], executionContext);
  if (authorization.response) return authorization.response;
  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  const url = new URL(request.url);
  const query = String(url.searchParams.get("query") || "").trim().slice(0, 200);
  const role = String(url.searchParams.get("role") || "").trim().toLowerCase();
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 30));
  const clauses = [];
  const bindings = [];
  if (["reader", "author", "admin"].includes(role)) {
    clauses.push("role = ?");
    bindings.push(role);
  }
  if (query) {
    clauses.push("(display_name LIKE ? OR user_id LIKE ?)");
    const like = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    bindings.push(like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const offset = (page - 1) * limit;
  const [rows, count] = await Promise.all([
    env.DB.prepare(`SELECT user_id, display_name, role, created_at, updated_at
      FROM profiles ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...bindings, limit, offset).all(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM profiles ${where}`)
      .bind(...bindings).first(),
  ]);
  const total = Number(count?.total || 0);
  return Response.json({
    users: rows.results || [], page, limit, total,
    hasMore: offset + (rows.results || []).length < total,
  });
}
