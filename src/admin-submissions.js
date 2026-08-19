import { requireRoles } from "./authorization.js";
import { queueTransactionalEmail } from "./email.js";

const decisions = new Set(["approve", "request_changes", "reject"]);

function error(message, status) {
  return Response.json({ error: message }, { status });
}

export function buildCreatorReviewEmail(row, decision, baseUrl) {
  const creatorUrl = new URL("/creator-access.html", baseUrl).toString();
  const bookTitle = row.title || "your first book";

  if (decision === "approve") {
    return {
      type: "creator-application-approved",
      to: row.email,
      subject: "Your Free Bookery Creator Access was approved",
      heading: "Welcome to Creator Access",
      message: row.admin_message
        ? `Your application and “${bookTitle}” were approved. Message from our review team: ${row.admin_message}`
        : `Your application and “${bookTitle}” were approved. You can now open your Author workspace and publish with Free Bookery.`,
      actionLabel: "Open Creator Access",
      actionUrl: creatorUrl,
    };
  }

  if (decision === "request_changes") {
    return {
      type: "creator-application-changes-requested",
      to: row.email,
      subject: "Changes requested for your Free Bookery application",
      heading: "Please update your Creator application",
      message: `Our review team requested changes to your application and “${bookTitle}”: ${row.admin_message}`,
      actionLabel: "Review requested changes",
      actionUrl: creatorUrl,
    };
  }

  return {
    type: "creator-application-rejected",
    to: row.email,
    subject: "Update on your Free Bookery Creator application",
    heading: "Your Creator application was not approved",
    message: `Our review team could not approve your application and “${bookTitle}”: ${row.admin_message}`,
    actionLabel: "View application details",
    actionUrl: creatorUrl,
  };
}

function buildBookReviewEmail(row, decision, baseUrl) {
  const creatorUrl = new URL("/creator-access.html", baseUrl).toString();
  const title = row.title || "your book";
  const approved = decision === "approve";
  const changes = decision === "request_changes";
  return {
    type: approved ? "book-approved" : changes ? "book-changes-requested" : "book-rejected",
    to: row.email,
    subject: approved
      ? `“${title}” was approved by Free Bookery`
      : changes ? `Changes requested for “${title}”` : `Update on “${title}”`,
    heading: approved ? "Your book is live" : changes ? "Please update your book submission" : "Your book was not approved",
    message: approved
      ? (row.admin_message ? `“${title}” was approved. Message from our review team: ${row.admin_message}` : `“${title}” was approved and is now in the Free Bookery catalog.`)
      : `Our review team ${changes ? "requested changes to" : "could not approve"} “${title}”: ${row.admin_message}`,
    actionLabel: "Open Author workspace",
    actionUrl: creatorUrl,
  };
}

function mutationOriginIsTrusted(request, env) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = env.BETTER_AUTH_URL
    ? new URL(env.BETTER_AUTH_URL).origin
    : requestOrigin;
  return origin === requestOrigin || origin === configuredOrigin;
}

async function readDecision(request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw error("JSON is required.", 415);
  }
  const raw = await request.text();
  if (raw.length > 5000) throw error("Request is too large.", 413);
  let body;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    throw error("Invalid JSON.", 400);
  }
  const decision = String(body.decision || "");
  const message = String(body.message || "").trim();
  if (!decisions.has(decision)) throw error("Invalid review decision.", 400);
  if (message.length > 2000) throw error("Review message is too long.", 400);
  if (decision !== "approve" && !message) {
    throw error("A message is required for this decision.", 400);
  }
  return { decision, message };
}

const reviewSelect = `SELECT
  a.id, a.user_id, a.creator_type, a.status, a.legal_name, a.pen_name,
  a.biography, a.website, a.verification_details, a.rights_confirmation,
  a.submitted_at, a.reviewed_at, a.admin_message,
  u.email, p.display_name, p.role,
  b.id AS book_id, b.status AS book_status, b.title, b.subtitle, b.language,
  b.isbn, b.series_name, b.edition, b.author_name, b.contributors,
  b.description, b.categories, b.keywords, b.reading_age,
  b.explicit_content, b.territories, b.accessibility_notes
  , b.book_object_key, b.manuscript_original_name, b.manuscript_content_type,
  b.manuscript_size, b.manuscript_uploaded_at, b.cover_object_key,
  b.cover_original_name, b.cover_content_type, b.cover_size, b.cover_uploaded_at
FROM author_applications a
JOIN profiles p ON p.user_id = a.user_id
JOIN "user" u ON u.id = a.user_id
LEFT JOIN books b ON b.application_id = a.id`;

const bookReviewSelect = `SELECT b.*, u.email, p.display_name, p.role
FROM books b
JOIN profiles p ON p.user_id = b.owner_user_id
JOIN "user" u ON u.id = b.owner_user_id`;

function serialize(row) {
  return {
    kind: "creator_application",
    id: row.id,
    status: row.status,
    applicant: {
      userId: row.user_id,
      accountName: row.display_name,
      email: row.email,
      role: row.role,
      creatorType: row.creator_type,
      legalName: row.legal_name || "",
      penName: row.pen_name || "",
      biography: row.biography || "",
      website: row.website || "",
      verificationDetails: row.verification_details || "",
      rightsConfirmation: row.rights_confirmation === 1,
    },
    book: row.book_id ? {
      id: row.book_id,
      status: row.book_status,
      title: row.title || "",
      subtitle: row.subtitle || "",
      language: row.language || "English",
      isbn: row.isbn || "",
      series: row.series_name || "",
      edition: row.edition || "",
      author: row.author_name || "",
      contributors: row.contributors || "",
      description: row.description || "",
      categories: row.categories || "",
      keywords: row.keywords || "",
      readingAge: row.reading_age || "",
      explicit: row.explicit_content === 1,
      territories: row.territories || "Worldwide",
      accessibility: row.accessibility_notes || "",
      manuscript: row.book_object_key ? {
        name: row.manuscript_original_name,
        contentType: row.manuscript_content_type,
        size: row.manuscript_size,
        uploadedAt: row.manuscript_uploaded_at,
        url: `/api/creator-applications/${row.id}/files/manuscript`,
      } : null,
      cover: row.cover_object_key ? {
        name: row.cover_original_name,
        contentType: row.cover_content_type,
        size: row.cover_size,
        uploadedAt: row.cover_uploaded_at,
        url: `/api/creator-applications/${row.id}/files/cover`,
      } : null,
    } : null,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    adminMessage: row.admin_message,
  };
}

function serializeBook(row) {
  const file = (kind) => {
    const manuscript = kind === "manuscript";
    const key = manuscript ? row.book_object_key : row.cover_object_key;
    if (!key) return null;
    return {
      name: manuscript ? row.manuscript_original_name : row.cover_original_name,
      contentType: manuscript ? row.manuscript_content_type : row.cover_content_type,
      size: manuscript ? row.manuscript_size : row.cover_size,
      uploadedAt: manuscript ? row.manuscript_uploaded_at : row.cover_uploaded_at,
      url: `/api/author/books/${row.id}/files/${kind}`,
    };
  };
  return {
    kind: "book",
    id: row.id,
    status: row.status,
    applicant: {
      userId: row.owner_user_id,
      accountName: row.display_name,
      email: row.email,
      role: row.role,
      creatorType: "author",
      legalName: row.display_name,
      rightsConfirmation: Boolean(row.rights_statement),
    },
    book: {
      id: row.id, status: row.status, title: row.title || "", subtitle: row.subtitle || "",
      language: row.language || "English", isbn: row.isbn || "", doi: row.doi || "",
      series: row.series_name || "", edition: row.edition || "", author: row.author_name || "",
      contributors: row.contributors || "", description: row.description || "",
      categories: row.categories || "", keywords: row.keywords || "",
      readingAge: row.reading_age || "", explicit: row.explicit_content === 1,
      territories: row.territories || "Worldwide", accessibility: row.accessibility_notes || "",
      manuscript: file("manuscript"), cover: file("cover"),
    },
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    adminMessage: row.admin_message,
  };
}

async function listPending(env) {
  const [applications, books] = await Promise.all([
    env.DB.prepare(`${reviewSelect} WHERE a.status = 'pending' ORDER BY a.submitted_at ASC`).all(),
    env.DB.prepare(`${bookReviewSelect} WHERE b.application_id IS NULL AND b.status = 'pending' ORDER BY b.submitted_at ASC`).all(),
  ]);
  return [
    ...(applications.results || []).map(serialize),
    ...(books.results || []).map(serializeBook),
  ].sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));
}

async function findSubmission(env, id) {
  return env.DB.prepare(`${reviewSelect} WHERE a.id = ? LIMIT 1`).bind(id).first();
}

async function findBookSubmission(env, id) {
  return env.DB.prepare(`${bookReviewSelect} WHERE b.id = ? AND b.application_id IS NULL LIMIT 1`).bind(id).first();
}

async function reviewBookSubmission(env, adminId, id, review) {
  const current = await findBookSubmission(env, id);
  if (!current) return { response: error("Submission not found.", 404) };
  if (current.status !== "pending") return { response: error("Only pending submissions can be reviewed.", 409) };
  const nextStatus = review.decision === "approve"
    ? "approved" : review.decision === "request_changes" ? "changes_requested" : "rejected";
  const notificationType = review.decision === "approve"
    ? "book_approved" : review.decision === "request_changes" ? "book_changes_requested" : "book_rejected";
  const notificationTitle = review.decision === "approve"
    ? "Book approved" : review.decision === "request_changes" ? "Changes requested for your book" : "Book not approved";
  const notificationMessage = review.message || `“${current.title}” was approved and is now live.`;
  await env.DB.batch([
    env.DB.prepare(`UPDATE books SET status = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?,
      admin_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`)
      .bind(nextStatus, adminId, review.message || null, id),
    env.DB.prepare(`INSERT INTO notifications
      (id, user_id, type, title, message, related_record_type, related_record_id)
      VALUES (?, ?, ?, ?, ?, 'book', ?)`)
      .bind(crypto.randomUUID(), current.owner_user_id, notificationType, notificationTitle, notificationMessage, id),
    env.DB.prepare(`INSERT INTO audit_log
      (id, admin_user_id, action, target_type, target_id, previous_value, new_value)
      VALUES (?, ?, ?, 'book', ?, ?, ?)`)
      .bind(crypto.randomUUID(), adminId, `book_submission.${review.decision}`, id,
        JSON.stringify({ status: current.status }),
        JSON.stringify({ status: nextStatus, message: review.message || null })),
  ]);
  return { row: await findBookSubmission(env, id) };
}

async function reviewSubmission(env, adminId, id, review) {
  const current = await findSubmission(env, id);
  if (!current) return { response: error("Submission not found.", 404) };
  if (current.status !== "pending") {
    return { response: error("Only pending submissions can be reviewed.", 409) };
  }

  const approved = review.decision === "approve";
  const nextStatus = approved
    ? "approved"
    : review.decision === "request_changes"
      ? "changes_requested"
      : "rejected";
  const notificationType = approved
    ? "application_approved"
    : review.decision === "request_changes"
      ? "application_changes_requested"
      : "application_rejected";
  const notificationTitle = approved
    ? "Creator Access approved"
    : review.decision === "request_changes"
      ? "Changes requested for your Creator application"
      : "Creator application not approved";
  const notificationMessage = review.message ||
    "Your Creator Access application and first book were approved.";

  const statements = [
    env.DB.prepare(
      `UPDATE author_applications SET status = ?, reviewed_at = CURRENT_TIMESTAMP,
       reviewed_by = ?, admin_message = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'pending'`
    ).bind(nextStatus, adminId, review.message || null, id),
    env.DB.prepare(
      `UPDATE books SET status = ?, reviewed_at = CURRENT_TIMESTAMP,
       reviewed_by = ?, admin_message = ?, updated_at = CURRENT_TIMESTAMP
       WHERE application_id = ? AND status = 'pending'`
    ).bind(nextStatus, adminId, review.message || null, id),
    env.DB.prepare(
      `INSERT INTO notifications
       (id, user_id, type, title, message, related_record_type, related_record_id)
       VALUES (?, ?, ?, ?, ?, 'author_application', ?)`
    ).bind(crypto.randomUUID(), current.user_id, notificationType,
      notificationTitle, notificationMessage, id),
    env.DB.prepare(
      `INSERT INTO audit_log
       (id, admin_user_id, action, target_type, target_id, previous_value, new_value)
       VALUES (?, ?, ?, 'author_application', ?, ?, ?)`
    ).bind(crypto.randomUUID(), adminId, `creator_application.${review.decision}`,
      id, JSON.stringify({ status: current.status }),
      JSON.stringify({ status: nextStatus, message: review.message || null })),
  ];

  if (approved) {
    statements.push(env.DB.prepare(
      `UPDATE profiles SET role = 'author', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND role = 'reader'`
    ).bind(current.user_id));
  }

  await env.DB.batch(statements);
  return { row: await findSubmission(env, id) };
}

export async function handleAdminSubmissionRequest(request, env, executionContext) {
  const authorization = await requireRoles(
    request, env, ["admin"], executionContext
  );
  if (authorization.response) return authorization.response;

  const url = new URL(request.url);
  if (url.pathname === "/api/admin/submissions" && request.method === "GET") {
    return Response.json({ submissions: await listPending(env) });
  }

  const match = url.pathname.match(/^\/api\/admin\/submissions\/([0-9a-f-]+)$/i);
  if (!match) return error("Not found.", 404);
  if (request.method === "GET") {
    const row = await findSubmission(env, match[1]);
    if (row) return Response.json({ submission: serialize(row) });
    const book = await findBookSubmission(env, match[1]);
    return book ? Response.json({ submission: serializeBook(book) }) : error("Submission not found.", 404);
  }
  if (request.method !== "POST") return error("Method not allowed.", 405);
  if (!mutationOriginIsTrusted(request, env)) return error("Invalid origin.", 403);

  let review;
  try {
    review = await readDecision(request);
  } catch (response) {
    return response instanceof Response ? response : error("Invalid request.", 400);
  }
  const application = await findSubmission(env, match[1]);
  const result = application
    ? await reviewSubmission(env, authorization.account.profile.user_id, match[1], review)
    : await reviewBookSubmission(env, authorization.account.profile.user_id, match[1], review);
  if (result.response) return result.response;

  const baseUrl = env.BETTER_AUTH_URL || new URL(request.url).origin;
  const isBook = !application;
  queueTransactionalEmail(executionContext, env,
    isBook ? buildBookReviewEmail(result.row, review.decision, baseUrl)
      : buildCreatorReviewEmail(result.row, review.decision, baseUrl));
  return Response.json({ submission: isBook ? serializeBook(result.row) : serialize(result.row) });
}
