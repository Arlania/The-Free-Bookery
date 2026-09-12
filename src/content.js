import { requireRoles } from "./authorization.js";

function error(message, status) { return Response.json({ error: message }, { status }); }
function clean(value, max, required = false) {
  const result = String(value || "").trim();
  if (required && !result) throw error("Complete all required fields.", 400);
  if (result.length > max) throw error("One or more fields are too long.", 400);
  return result;
}
function trustedOrigin(request, env) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const current = new URL(request.url).origin;
  const configured = env.BETTER_AUTH_URL ? new URL(env.BETTER_AUTH_URL).origin : current;
  return origin === current || origin === configured;
}
function serialize(row) {
  return {
    id: row.id, type: row.content_type, title: row.title, summary: row.summary,
    body: row.body, category: row.category, author: row.author_name || "Free Bookery",
    publishedAt: row.published_at, updatedAt: row.updated_at,
  };
}

function serializeSubmission(row) {
  return {
    id: row.id, authorUserId: row.author_user_id, authorName: row.author_name,
    title: row.title, summary: row.summary, body: row.body, category: row.category,
    status: row.status, adminMessage: row.admin_message, createdAt: row.created_at,
    updatedAt: row.updated_at, reviewedAt: row.reviewed_at,
  };
}

async function json(request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw error("JSON is required.", 415);
  try { return await request.json(); } catch { throw error("Invalid JSON.", 400); }
}

export async function handleContentRequest(request, env, executionContext) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/content") {
    const type = String(url.searchParams.get("type") || "").toLowerCase();
    if (type && !["blog", "newsletter"].includes(type)) return error("Invalid content type.", 400);
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit")) || 20));
    const where = type ? "WHERE c.content_type = ?" : "";
    const statement = env.DB.prepare(`SELECT c.*, p.display_name AS author_name
      FROM published_content c LEFT JOIN profiles p ON p.user_id = c.published_by
      ${where} ORDER BY c.published_at DESC LIMIT ?`);
    const rows = type ? await statement.bind(type, limit).all() : await statement.bind(limit).all();
    return Response.json({ content: (rows.results || []).map(serialize) });
  }

  if (url.pathname === "/api/author/blog-submissions") {
    const authorization = await requireRoles(request, env, ["author"], executionContext);
    if (authorization.response) return authorization.response;
    const userId = authorization.account.profile.user_id;
    if (request.method === "GET") {
      const rows = await env.DB.prepare(`SELECT s.*, p.display_name AS author_name FROM blog_submissions s
        JOIN profiles p ON p.user_id = s.author_user_id WHERE s.author_user_id = ?
        ORDER BY s.created_at DESC`).bind(userId).all();
      return Response.json({ submissions: (rows.results || []).map(serializeSubmission) });
    }
    if (request.method !== "POST") return error("Method not allowed.", 405);
    if (!trustedOrigin(request, env)) return error("Invalid origin.", 403);
    let data; try { data = await json(request); } catch (response) { return response; }
    let title, summary, content, category;
    try { title = clean(data.title, 220, true); summary = clean(data.summary, 500);
      content = clean(data.body, 20000, true); category = clean(data.category, 100, true); }
    catch (response) { return response; }
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO blog_submissions
        (id, author_user_id, title, summary, body, category) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(id, userId, title, summary || null, content, category),
      env.DB.prepare(`INSERT INTO notifications
        (id, user_id, type, title, message, related_record_type, related_record_id)
        VALUES (?, ?, 'blog_submitted', 'Blog submitted', ?, 'blog_submission', ?)`)
        .bind(crypto.randomUUID(), userId, `“${title}” is waiting for Admin review.`, id),
    ]);
    return Response.json({ success: true, id }, { status: 201 });
  }

  if (url.pathname === "/api/admin/blog-submissions" && request.method === "GET") {
    const authorization = await requireRoles(request, env, ["admin"], executionContext);
    if (authorization.response) return authorization.response;
    const rows = await env.DB.prepare(`SELECT s.*, p.display_name AS author_name FROM blog_submissions s
      JOIN profiles p ON p.user_id = s.author_user_id WHERE s.status = 'pending'
      ORDER BY s.created_at ASC`).all();
    return Response.json({ submissions: (rows.results || []).map(serializeSubmission) });
  }

  const reviewMatch = url.pathname.match(/^\/api\/admin\/blog-submissions\/([0-9a-f-]+)$/i);
  if (reviewMatch && request.method === "PATCH") {
    const authorization = await requireRoles(request, env, ["admin"], executionContext);
    if (authorization.response) return authorization.response;
    if (!trustedOrigin(request, env)) return error("Invalid origin.", 403);
    let data; try { data = await json(request); } catch (response) { return response; }
    const decision = String(data.decision || "");
    const message = clean(data.message, 2000);
    if (!["approve", "request_changes", "reject"].includes(decision)) return error("Invalid decision.", 400);
    if (decision !== "approve" && !message) return error("A message to the Author is required.", 400);
    const submission = await env.DB.prepare("SELECT * FROM blog_submissions WHERE id = ? AND status = 'pending'")
      .bind(reviewMatch[1]).first();
    if (!submission) return error("Pending submission not found.", 404);
    const nextStatus = decision === "approve" ? "approved" : decision === "request_changes" ? "changes_requested" : "rejected";
    const publishedId = decision === "approve" ? crypto.randomUUID() : null;
    const statements = [];
    if (publishedId) statements.push(env.DB.prepare(`INSERT INTO published_content
      (id, content_type, title, summary, body, category, published_by)
      VALUES (?, 'blog', ?, ?, ?, ?, ?)`)
      .bind(publishedId, submission.title, submission.summary, submission.body, submission.category, submission.author_user_id));
    statements.push(
      env.DB.prepare(`UPDATE blog_submissions SET status = ?, admin_message = ?, reviewed_by = ?,
        reviewed_at = CURRENT_TIMESTAMP, published_content_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(nextStatus, message || null, authorization.account.profile.user_id, publishedId, submission.id),
      env.DB.prepare(`INSERT INTO notifications
        (id, user_id, type, title, message, related_record_type, related_record_id)
        VALUES (?, ?, 'blog_reviewed', ?, ?, 'blog_submission', ?)`)
        .bind(crypto.randomUUID(), submission.author_user_id,
          decision === "approve" ? "Blog approved" : decision === "request_changes" ? "Changes requested for your blog" : "Blog not approved",
          message || `“${submission.title}” is approved and now published.`, submission.id),
      env.DB.prepare(`INSERT INTO audit_log
        (id, admin_user_id, action, target_type, target_id, previous_value, new_value)
        VALUES (?, ?, ?, 'blog_submission', ?, ?, ?)`)
        .bind(crypto.randomUUID(), authorization.account.profile.user_id, `blog_submission.${decision}`,
          submission.id, JSON.stringify({ status: "pending" }), JSON.stringify({ status: nextStatus, message: message || null }))
    );
    await env.DB.batch(statements);
    return Response.json({ success: true, status: nextStatus });
  }

  if (request.method !== "POST" || url.pathname !== "/api/admin/content") {
    return error("Not found.", 404);
  }
  const authorization = await requireRoles(request, env, ["admin"], executionContext);
  if (authorization.response) return authorization.response;
  if (!trustedOrigin(request, env)) return error("Invalid origin.", 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return error("JSON is required.", 415);
  let body;
  try { body = await request.json(); } catch { return error("Invalid JSON.", 400); }
  const type = String(body.type || "").toLowerCase();
  if (type !== "newsletter") return error("Only newsletters can be published directly.", 400);
  let title, summary, content, category;
  try {
    title = clean(body.title, 220, true);
    summary = clean(body.summary, 500);
    content = clean(body.body, 20000, true);
    category = clean(body.category, 100);
  } catch (response) { return response; }
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO published_content
    (id, content_type, title, summary, body, category, published_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, type, title, summary || null, content, category || null,
      authorization.account.profile.user_id).run();
  const row = await env.DB.prepare(`SELECT c.*, p.display_name AS author_name
    FROM published_content c LEFT JOIN profiles p ON p.user_id = c.published_by
    WHERE c.id = ?`).bind(id).first();
  return Response.json({ content: serialize(row) }, { status: 201 });
}
