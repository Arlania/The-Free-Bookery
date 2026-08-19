import { getAccountContext } from "./authorization.js";

const allowedViews = new Set(["reader", "author", "admin"]);

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

export async function handleOwnerRequest(request, env, executionContext) {
  const account = await getAccountContext(request, env, executionContext);
  if (!account) return error("Authentication required.", 401);
  if (account.accountRole !== "owner") return error("Owner access is required.", 403);
  if (request.method !== "POST") return error("Method not allowed.", 405);
  if (!trustedOrigin(request, env)) return error("Invalid origin.", 403);
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return error("JSON is required.", 415);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON.", 400);
  }
  const viewAs = String(body.viewAs || "");
  if (!allowedViews.has(viewAs)) return error("Invalid account view.", 400);

  await env.DB.prepare(
    `INSERT INTO owner_view_preferences (user_id, view_as_role, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       view_as_role = excluded.view_as_role,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(account.profile.user_id, viewAs).run();

  return Response.json({
    accountRole: "owner",
    role: viewAs,
    canSwitchRole: true,
    availableViews: [...allowedViews],
  });
}
