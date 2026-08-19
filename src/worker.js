import { createAuth } from "./auth.js";
import { requireRoles } from "./authorization.js";
import { handleCreatorApplicationRequest } from "./creator-applications.js";
import { handleAdminSubmissionRequest } from "./admin-submissions.js";
import { handleBookFileRequest } from "./book-files.js";
import { handleBookRequest } from "./books.js";
import { handleOwnerRequest } from "./owner.js";
import { handleAuthorBookRequest } from "./author-books.js";
import { handleAuthorBookFileRequest } from "./book-files.js";
import { handleNotificationRequest } from "./notifications.js";
import { handleAdminActivityRequest } from "./admin-activity.js";
import { handleAdminUsersRequest } from "./admin-users.js";
import { handleReaderLibraryRequest } from "./reader-library.js";
import { handleBookRequestWorkflow } from "./book-requests.js";

export default {
  async fetch(request, env, executionContext) {
    const url = new URL(request.url);

    if (
      url.pathname === "/api/auth" ||
      url.pathname.startsWith("/api/auth/")
    ) {
      return createAuth(env, request.url, executionContext).handler(request);
    }

    if (url.pathname === "/api/health") {
      const databaseCheck = await env.DB.prepare(
        "SELECT 1 AS available"
      ).first();

      return Response.json({
        ok: true,
        service: "the-free-book-nook",
        database: databaseCheck?.available === 1,
      });
    }

    if (url.pathname === "/api/account" && request.method === "GET") {
      const authorization = await requireRoles(
        request,
        env,
        ["reader", "author", "admin"],
        executionContext
      );
      if (authorization.response) return authorization.response;

      const { session, profile } = authorization.account;
      return Response.json({
        authenticated: true,
        id: session.user.id,
        name: profile.display_name,
        email: session.user.email,
        role: profile.role,
        accountRole: authorization.account.accountRole,
        canSwitchRole: authorization.account.accountRole === "owner",
        availableViews: authorization.account.accountRole === "owner"
          ? ["reader", "author", "admin"]
          : [],
        unreadNotificationCount: Number((await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL"
        ).bind(profile.user_id).first())?.count || 0),
      });
    }

    if (url.pathname === "/api/owner/view-as") {
      return handleOwnerRequest(request, env, executionContext);
    }

    if (url.pathname.startsWith("/api/books/")) {
      return handleBookRequest(request, env, executionContext);
    }

    if (/^\/api\/creator-applications\/[0-9a-f-]+\/files\//i.test(url.pathname)) {
      return handleBookFileRequest(request, env, executionContext);
    }

    if (/^\/api\/author\/books\/[0-9a-f-]+\/files\//i.test(url.pathname)) {
      return handleAuthorBookFileRequest(request, env, executionContext);
    }

    if (url.pathname.startsWith("/api/author/books")) {
      return handleAuthorBookRequest(request, env, executionContext);
    }

    if (url.pathname.startsWith("/api/admin/submissions")) {
      return handleAdminSubmissionRequest(request, env, executionContext);
    }

    if (url.pathname.startsWith("/api/admin/activity")) {
      return handleAdminActivityRequest(request, env, executionContext);
    }

    if (url.pathname.startsWith("/api/admin/users")) {
      return handleAdminUsersRequest(request, env, executionContext);
    }

    if (url.pathname.startsWith("/api/admin/book-requests") || url.pathname.startsWith("/api/book-requests")) {
      return handleBookRequestWorkflow(request, env, executionContext);
    }

    if (url.pathname.startsWith("/api/notifications")) {
      return handleNotificationRequest(request, env, executionContext);
    }

    if (url.pathname.startsWith("/api/collections") || url.pathname.startsWith("/api/starred")) {
      return handleReaderLibraryRequest(request, env, executionContext);
    }

    if (url.pathname.startsWith("/api/creator-applications")) {
      return handleCreatorApplicationRequest(request, env, executionContext);
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};
