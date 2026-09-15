import { requireRolesOrOwner } from "./authorization.js";
import { queueTransactionalEmail } from "./email.js";
import { findDuplicateBooks, storedBookFilesExist } from "./book-metadata.js";

const decisions = new Set(["approve", "request_changes", "reject"]);

function error(message, status) {
  return Response.json({ error: message }, { status });
}

export function buildCreatorReviewEmail(row, decision, baseUrl) {
  const creatorUrl = new URL("/creator-access.html", baseUrl).toString();
  const approved = decision === "approve";
  const changes = decision === "request_changes";
  return {
    type: approved ? "creator-application-approved" : changes
      ? "creator-application-changes-requested" : "creator-application-rejected",
    to: row.email,
    subject: approved
      ? "Your Free Bookery Author application was approved"
      : changes ? "Changes requested for your Free Bookery Author application"
        : "Your Free Bookery Author application was not approved",
    heading: approved ? "Welcome to Creator Access" : changes
      ? "Please update your Author application" : "Author application not approved",
    message: approved
      ? (row.admin_message
        ? `Your Author application was approved. Message from our review team: ${row.admin_message}`
        : "Your Author application was approved. You can now use Creator Access to submit books for review.")
      : changes
        ? `Our review team requested changes to your Author application: ${row.admin_message}`
        : `Your Author application was not approved, so its first-book submission was automatically withdrawn: ${row.admin_message}`,
    actionLabel: approved ? "Open Creator Access" : "View application",
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
      : changes ? `Changes requested for “${title}”` : `“${title}” was not approved`,
    heading: approved ? "Your book is live" : changes
      ? "Please update your book submission" : "Book submission not approved",
    message: approved
      ? (row.admin_message
        ? `“${title}” is now live. Message from our review team: ${row.admin_message}`
        : `“${title}” is now searchable and readable in the Free Bookery catalog.`)
      : `Our review team ${changes ? "requested changes to" : "did not approve"} “${title}”: ${row.admin_message}`,
    actionLabel: "Open Creator Access",
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
  try { body = JSON.parse(raw || "{}"); }
  catch { throw error("Invalid JSON.", 400); }
  const decision = String(body.decision || "");
  const message = String(body.message || "").trim();
  const confirmDuplicate = body.confirmDuplicate === true;
  if (!decisions.has(decision)) throw error("Invalid review decision.", 400);
  if (message.length > 2000) throw error("Review message is too long.", 400);
  if (decision !== "approve" && !message) {
    throw error("A message is required for changes or rejection.", 400);
  }
  return { decision, message, confirmDuplicate };
}

const authorSelect = `SELECT
  a.id, a.user_id, a.creator_type, a.status, a.legal_name, a.pen_name,
  a.biography, a.website, a.verification_details, a.rights_confirmation,
  a.submitted_at, a.reviewed_at, a.admin_message,
  u.email, p.display_name, p.role,
  b.id AS first_book_id, b.title AS first_book_title, b.status AS first_book_status
FROM author_applications a
JOIN profiles p ON p.user_id = a.user_id
JOIN "user" u ON u.id = a.user_id
LEFT JOIN books b ON b.application_id = a.id`;

const bookSelect = `SELECT b.*, u.email, p.display_name, p.role,
  a.status AS author_application_status, a.legal_name, a.pen_name
FROM books b
JOIN profiles p ON p.user_id = b.owner_user_id
JOIN "user" u ON u.id = b.owner_user_id
LEFT JOIN author_applications a ON a.id = b.application_id`;

function serializeAuthor(row) {
  return {
    id: row.id,
    kind: "author",
    status: row.status,
    submittedAt: row.submitted_at,
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
    firstBook: row.first_book_id ? {
      id: row.first_book_id,
      title: row.first_book_title || "Untitled book",
      status: row.first_book_status,
    } : null,
  };
}

function serializeBook(row) {
  const applicationBook = Boolean(row.application_id);
  const file = (kind) => {
    const manuscript = kind === "manuscript";
    const key = manuscript ? row.book_object_key : row.cover_object_key;
    if (!key) return null;
    return {
      name: manuscript ? row.manuscript_original_name : row.cover_original_name,
      contentType: manuscript ? row.manuscript_content_type : row.cover_content_type,
      size: manuscript ? row.manuscript_size : row.cover_size,
      uploadedAt: manuscript ? row.manuscript_uploaded_at : row.cover_uploaded_at,
      url: applicationBook
        ? `/api/creator-applications/${row.application_id}/files/${kind}`
        : `/api/author/books/${row.id}/files/${kind}`,
    };
  };
  return {
    id: row.id,
    kind: "book",
    status: row.status,
    submittedAt: row.submitted_at,
    authorApplicationStatus: row.author_application_status || null,
    canApprove: applicationBook
      ? row.author_application_status === "approved"
      : row.role === "author",
    applicant: {
      userId: row.owner_user_id,
      accountName: row.display_name,
      email: row.email,
      role: row.role,
      legalName: row.legal_name || row.display_name,
      penName: row.pen_name || "",
      rightsConfirmation: Boolean(row.rights_statement),
    },
    book: {
      id: row.id,
      title: row.title || "",
      subtitle: row.subtitle || "",
      language: row.language || "English",
      isbn: row.isbn || "",
      doi: row.doi || "",
      series: row.series_name || "",
      edition: row.edition || "",
      author: row.author_name || "",
      contributors: row.contributors || "",
      description: row.description || "",
      categories: row.categories || "",
      territories: row.territories || "Worldwide",
      accessibility: row.accessibility_notes || "",
      manuscript: file("manuscript"),
      cover: file("cover"),
    },
    duplicateMatches: row.duplicateMatches || [],
  };
}

async function addDuplicateMatches(env, row) {
  const matches = await findDuplicateBooks(env, row);
  return {
    ...row,
    duplicateMatches: matches.map((item) => ({
      id: item.id,
      title: item.title,
      author: item.author_name,
      isbn: item.isbn,
      doi: item.doi,
      status: item.status,
    })),
  };
}

async function listPending(env) {
  const [authors, books] = await Promise.all([
    env.DB.prepare(`${authorSelect} WHERE a.status = 'pending' ORDER BY a.submitted_at ASC`).all(),
    env.DB.prepare(`${bookSelect} WHERE b.status = 'pending' ORDER BY b.submitted_at ASC`).all(),
  ]);
  return {
    authorApplications: (authors.results || []).map(serializeAuthor),
    bookSubmissions: await Promise.all(
      (books.results || []).map(async (row) => serializeBook(await addDuplicateMatches(env, row)))
    ),
  };
}

async function findAuthor(env, id) {
  return env.DB.prepare(`${authorSelect} WHERE a.id = ? LIMIT 1`).bind(id).first();
}

async function findBook(env, id) {
  return env.DB.prepare(`${bookSelect} WHERE b.id = ? LIMIT 1`).bind(id).first();
}

async function reviewAuthor(env, reviewerId, id, review) {
  const current = await findAuthor(env, id);
  if (!current) return { response: error("Author application not found.", 404) };
  if (current.status !== "pending") {
    return { response: error("Only pending Author applications can be reviewed.", 409) };
  }
  const nextStatus = review.decision === "approve" ? "approved"
    : review.decision === "request_changes" ? "changes_requested" : "rejected";
  const notificationType = review.decision === "approve" ? "application_approved"
    : review.decision === "request_changes" ? "application_changes_requested" : "application_rejected";
  const notificationTitle = review.decision === "approve" ? "Author application approved"
    : review.decision === "request_changes" ? "Changes requested for your Author application"
      : "Author application not approved";
  const notificationMessage = review.message || "Your Author application was approved.";
  const statements = [
    env.DB.prepare(`UPDATE author_applications SET status = ?, reviewed_at = CURRENT_TIMESTAMP,
      reviewed_by = ?, admin_message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'`)
      .bind(nextStatus, reviewerId, review.message || null, id),
    env.DB.prepare(`INSERT INTO notifications
      (id, user_id, type, title, message, related_record_type, related_record_id)
      VALUES (?, ?, ?, ?, ?, 'author_application', ?)`)
      .bind(crypto.randomUUID(), current.user_id, notificationType, notificationTitle, notificationMessage, id),
    env.DB.prepare(`INSERT INTO audit_log
      (id, admin_user_id, action, target_type, target_id, previous_value, new_value)
      VALUES (?, ?, ?, 'author_application', ?, ?, ?)`)
      .bind(crypto.randomUUID(), reviewerId, `author_application.${review.decision}`, id,
        JSON.stringify({ status: current.status }), JSON.stringify({ status: nextStatus, message: review.message || null })),
  ];
  if (review.decision === "approve") {
    statements.push(env.DB.prepare(`UPDATE profiles SET role = 'author', updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND role = 'reader'`).bind(current.user_id));
  }
  if (review.decision === "reject") {
    const withdrawalMessage = "Automatically withdrawn because the Author application was rejected.";
    if (current.first_book_id && current.first_book_status !== "approved") statements.push(
      env.DB.prepare(`UPDATE books SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = ?, admin_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE application_id = ? AND status != 'approved'`)
        .bind(reviewerId, withdrawalMessage, id),
      env.DB.prepare(`INSERT INTO audit_log
        (id, admin_user_id, action, target_type, target_id, previous_value, new_value)
        VALUES (?, ?, 'book.system_withdraw', 'book', ?, ?, ?)`)
        .bind(crypto.randomUUID(), reviewerId, current.first_book_id,
          JSON.stringify({ status: current.first_book_status }),
          JSON.stringify({ status: "rejected", reason: withdrawalMessage }))
    );
  }
  await env.DB.batch(statements);
  return { row: await findAuthor(env, id) };
}

async function reviewBook(env, reviewerId, id, review) {
  const current = await findBook(env, id);
  if (!current) return { response: error("Book submission not found.", 404) };
  if (current.status !== "pending") {
    return { response: error("Only pending book submissions can be reviewed.", 409) };
  }
  const authorApproved = current.application_id
    ? current.author_application_status === "approved"
    : current.role === "author";
  if (review.decision === "approve" && !authorApproved) {
    return { response: error("Approve the Author application before approving this book.", 409) };
  }
  if (review.decision === "approve" && !await storedBookFilesExist(env, current)) {
    return { response: error("The manuscript or cover is missing from private storage. Ask the Author to upload it again.", 409) };
  }
  const duplicates = review.decision === "approve" ? await findDuplicateBooks(env, current) : [];
  if (duplicates.length && !review.confirmDuplicate) {
    return { response: error("Confirm the matching ISBN or DOI before approving this book.", 409) };
  }
  const nextStatus = review.decision === "approve" ? "approved"
    : review.decision === "request_changes" ? "changes_requested" : "rejected";
  const notificationType = review.decision === "approve" ? "book_approved"
    : review.decision === "request_changes" ? "book_changes_requested" : "book_rejected";
  const notificationTitle = review.decision === "approve" ? "Book approved"
    : review.decision === "request_changes" ? "Changes requested for your book" : "Book not approved";
  const notificationMessage = review.message || `“${current.title}” is now live.`;
  await env.DB.batch([
    env.DB.prepare(`UPDATE books SET status = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?,
      admin_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`)
      .bind(nextStatus, reviewerId, review.message || null, id),
    env.DB.prepare(`INSERT INTO notifications
      (id, user_id, type, title, message, related_record_type, related_record_id)
      VALUES (?, ?, ?, ?, ?, 'book', ?)`)
      .bind(crypto.randomUUID(), current.owner_user_id, notificationType, notificationTitle, notificationMessage, id),
    env.DB.prepare(`INSERT INTO audit_log
      (id, admin_user_id, action, target_type, target_id, previous_value, new_value)
      VALUES (?, ?, ?, 'book', ?, ?, ?)`)
      .bind(crypto.randomUUID(), reviewerId, `book_submission.${review.decision}`, id,
        JSON.stringify({ status: current.status }), JSON.stringify({ status: nextStatus, message: review.message || null })),
  ]);
  return { row: await addDuplicateMatches(env, await findBook(env, id)) };
}

export async function handleAdminSubmissionRequest(request, env, executionContext) {
  const authorization = await requireRolesOrOwner(request, env, ["admin"], executionContext);
  if (authorization.response) return authorization.response;
  const url = new URL(request.url);

  if (url.pathname === "/api/admin/submissions" && request.method === "GET") {
    return Response.json(await listPending(env));
  }

  const match = url.pathname.match(/^\/api\/admin\/submissions\/(authors|books)\/([0-9a-f-]+)$/i);
  if (!match) return error("Not found.", 404);
  if (request.method !== "POST") return error("Method not allowed.", 405);
  if (!mutationOriginIsTrusted(request, env)) return error("Invalid origin.", 403);
  let review;
  try { review = await readDecision(request); }
  catch (response) { return response instanceof Response ? response : error("Invalid request.", 400); }

  const isAuthor = match[1].toLowerCase() === "authors";
  const result = isAuthor
    ? await reviewAuthor(env, authorization.account.profile.user_id, match[2], review)
    : await reviewBook(env, authorization.account.profile.user_id, match[2], review);
  if (result.response) return result.response;

  const baseUrl = env.BETTER_AUTH_URL || new URL(request.url).origin;
  queueTransactionalEmail(
    executionContext,
    env,
    isAuthor
      ? buildCreatorReviewEmail(result.row, review.decision, baseUrl)
      : buildBookReviewEmail(result.row, review.decision, baseUrl)
  );
  return Response.json({
    submission: isAuthor ? serializeAuthor(result.row) : serializeBook(result.row),
  });
}
