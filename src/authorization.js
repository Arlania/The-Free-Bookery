import { createAuth } from "./auth.js";

export async function getAccountContext(request, env, executionContext) {
  const auth = createAuth(env, request.url, executionContext);
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) return null;

  const profile = await env.DB.prepare(
    `SELECT p.user_id, p.display_name, p.role AS stored_role,
            CASE WHEN o.user_id IS NOT NULL THEN 'owner' ELSE p.role END AS account_role,
            CASE WHEN o.user_id IS NOT NULL
              THEN COALESCE(v.view_as_role, 'admin') ELSE p.role END AS role
     FROM profiles p
     LEFT JOIN platform_owners o ON o.user_id = p.user_id
     LEFT JOIN owner_view_preferences v ON v.user_id = p.user_id
     WHERE p.user_id = ?`
  )
    .bind(session.user.id)
    .first();

  if (!profile) return null;

  return { session, profile, accountRole: profile.account_role };
}

export async function requireRoles(request, env, allowedRoles, executionContext) {
  const account = await getAccountContext(request, env, executionContext);

  if (!account) {
    return {
      response: Response.json(
        { error: "Authentication required." },
        { status: 401 }
      ),
    };
  }

  if (!allowedRoles.includes(account.profile.role)) {
    return {
      response: Response.json(
        { error: "You do not have permission to access this resource." },
        { status: 403 }
      ),
    };
  }

  return { account };
}
