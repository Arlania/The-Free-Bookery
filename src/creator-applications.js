import { requireRoles } from "./authorization.js";

const editableStatuses = new Set(["draft", "changes_requested"]);
const textLimits = {
  creatorType: 20,
  legalName: 160,
  penName: 160,
  biography: 4000,
  website: 500,
  verificationDetails: 4000,
  title: 300,
  subtitle: 300,
  language: 80,
  isbn: 40,
  series: 200,
  edition: 80,
  author: 300,
  contributors: 1000,
  description: 4000,
  categories: 500,
  keywords: 1000,
  readingAge: 100,
  territories: 200,
  accessibility: 1000,
};

function jsonError(message, status) {
  return Response.json({ error: message }, { status });
}

async function readJson(request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new Response(JSON.stringify({ error: "JSON is required." }), {
      status: 415,
      headers: { "Content-Type": "application/json" },
    });
  }

  const raw = await request.text();
  if (raw.length > 30000) {
    throw new Response(JSON.stringify({ error: "Request is too large." }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new Response(JSON.stringify({ error: "Invalid JSON." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function cleanText(value, field) {
  const text = String(value ?? "").trim();
  if (text.length > textLimits[field]) {
    throw new Response(
      JSON.stringify({ error: `${field} is too long.` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  return text;
}

function normalizePayload(body) {
  const application = body?.application || {};
  const book = body?.book || {};
  const creatorType = cleanText(application.creatorType || "author", "creatorType");

  if (!["author", "publisher"].includes(creatorType)) {
    throw new Response(JSON.stringify({ error: "Invalid creator type." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return {
    application: {
      creatorType,
      legalName: cleanText(application.legalName, "legalName"),
      penName: cleanText(application.penName, "penName"),
      biography: cleanText(application.biography, "biography"),
      website: cleanText(application.website, "website"),
      verificationDetails: cleanText(
        application.verificationDetails,
        "verificationDetails"
      ),
      rightsConfirmation: application.rightsConfirmation === true,
    },
    book: {
      title: cleanText(book.title, "title"),
      subtitle: cleanText(book.subtitle, "subtitle"),
      language: cleanText(book.language || "English", "language"),
      isbn: cleanText(book.isbn, "isbn"),
      series: cleanText(book.series, "series"),
      edition: cleanText(book.edition, "edition"),
      author: cleanText(book.author, "author"),
      contributors: cleanText(book.contributors, "contributors"),
      description: cleanText(book.description, "description"),
      categories: cleanText(book.categories, "categories"),
      keywords: cleanText(book.keywords, "keywords"),
      readingAge: cleanText(book.readingAge, "readingAge"),
      explicit: book.explicit === true,
      territories: cleanText(book.territories || "Worldwide", "territories"),
      accessibility: cleanText(book.accessibility, "accessibility"),
    },
  };
}

async function findApplication(env, userId, applicationId) {
  const whereId = applicationId ? "AND a.id = ?" : "";
  const statement = env.DB.prepare(
    `SELECT
       a.id, a.user_id, a.creator_type, a.status, a.legal_name, a.pen_name,
       a.biography, a.website, a.verification_details,
       a.rights_confirmation, a.submitted_at, a.reviewed_at,
       a.admin_message, a.created_at, a.updated_at,
       b.id AS book_id, b.title, b.subtitle, b.language, b.isbn,
       b.series_name, b.edition, b.author_name, b.contributors,
       b.description, b.categories, b.keywords, b.reading_age,
       b.explicit_content, b.territories, b.accessibility_notes,
       b.book_object_key, b.manuscript_original_name,
       b.manuscript_content_type, b.manuscript_size, b.manuscript_uploaded_at,
       b.cover_object_key, b.cover_original_name, b.cover_content_type,
       b.cover_size, b.cover_uploaded_at,
       b.status AS book_status
     FROM author_applications AS a
     LEFT JOIN books AS b ON b.application_id = a.id
     WHERE a.user_id = ? ${whereId}
     ORDER BY a.created_at DESC
     LIMIT 1`
  );

  return applicationId
    ? statement.bind(userId, applicationId).first()
    : statement.bind(userId).first();
}

function serialize(row) {
  if (!row) return { application: null, book: null };
  return {
    application: {
      id: row.id,
      creatorType: row.creator_type,
      status: row.status,
      legalName: row.legal_name || "",
      penName: row.pen_name || "",
      biography: row.biography || "",
      website: row.website || "",
      verificationDetails: row.verification_details || "",
      rightsConfirmation: row.rights_confirmation === 1,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      adminMessage: row.admin_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    book: row.book_id
      ? {
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
        }
      : null,
  };
}

async function createApplication(env, userId) {
  const existing = await env.DB.prepare(
    `SELECT id FROM author_applications
     WHERE user_id = ?
       AND status IN ('draft', 'pending', 'changes_requested', 'approved')
     ORDER BY created_at DESC LIMIT 1`
  )
    .bind(userId)
    .first();

  if (existing) {
    return {
      row: await findApplication(env, userId, existing.id),
      created: false,
    };
  }

  const applicationId = crypto.randomUUID();
  const bookId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO author_applications (id, user_id, creator_type, status)
       VALUES (?, ?, 'author', 'draft')`
    ).bind(applicationId, userId),
    env.DB.prepare(
      `INSERT INTO books (
         id, owner_user_id, application_id, title, author_name, status
       ) VALUES (?, ?, ?, '', '', 'draft')`
    ).bind(bookId, userId, applicationId),
  ]);

  return {
    row: await findApplication(env, userId, applicationId),
    created: true,
  };
}

async function updateDraft(env, userId, applicationId, payload) {
  const current = await findApplication(env, userId, applicationId);
  if (!current) return { error: jsonError("Application not found.", 404) };
  if (!editableStatuses.has(current.status)) {
    return { error: jsonError("This application cannot currently be edited.", 409) };
  }

  const { application, book } = payload;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE author_applications SET
         creator_type = ?, legal_name = ?, pen_name = ?, biography = ?,
         website = ?, verification_details = ?, rights_confirmation = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`
    ).bind(
      application.creatorType,
      application.legalName,
      application.penName,
      application.biography,
      application.website,
      application.verificationDetails,
      application.rightsConfirmation ? 1 : 0,
      applicationId,
      userId
    ),
    env.DB.prepare(
      `UPDATE books SET
         title = ?, subtitle = ?, language = ?, isbn = ?, series_name = ?,
         edition = ?, author_name = ?, contributors = ?, description = ?,
         categories = ?, keywords = ?, reading_age = ?, explicit_content = ?,
         territories = ?, accessibility_notes = ?, rights_statement = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE application_id = ? AND owner_user_id = ?`
    ).bind(
      book.title,
      book.subtitle,
      book.language,
      book.isbn,
      book.series,
      book.edition,
      book.author,
      book.contributors,
      book.description,
      book.categories,
      book.keywords,
      book.readingAge,
      book.explicit ? 1 : 0,
      book.territories,
      book.accessibility,
      application.rightsConfirmation ? "Confirmed by applicant" : "",
      applicationId,
      userId
    ),
  ]);

  return { row: await findApplication(env, userId, applicationId) };
}

function validateSubmission(row) {
  const missing = [];
  if (!row.legal_name) missing.push("legal name");
  if (!row.biography) missing.push("biography");
  if (!row.verification_details) missing.push("verification details");
  if (row.rights_confirmation !== 1) missing.push("rights confirmation");
  if (!row.title) missing.push("book title");
  if (!row.author_name) missing.push("primary author");
  if (!row.description) missing.push("description");
  if (!row.categories) missing.push("categories");
  if (!row.book_object_key) missing.push("book file");
  if (!row.cover_object_key) missing.push("cover image");
  return missing;
}

async function submitApplication(env, userId, applicationId) {
  const current = await findApplication(env, userId, applicationId);
  if (!current) return { error: jsonError("Application not found.", 404) };
  if (!editableStatuses.has(current.status)) {
    return { error: jsonError("This application cannot be submitted.", 409) };
  }

  const missing = validateSubmission(current);
  if (missing.length) {
    return {
      error: jsonError(`Complete these fields: ${missing.join(", ")}.`, 400),
    };
  }

  const notificationId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE author_applications SET status = 'pending',
       submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`
    ).bind(applicationId, userId),
    env.DB.prepare(
      `UPDATE books SET status = 'pending', submitted_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
       WHERE application_id = ? AND owner_user_id = ?`
    ).bind(applicationId, userId),
    env.DB.prepare(
      `INSERT INTO notifications (
         id, user_id, type, title, message, related_record_type,
         related_record_id
       ) VALUES (?, ?, 'application_submitted', ?, ?, 'author_application', ?)`
    ).bind(
      notificationId,
      userId,
      "Creator application submitted",
      "Your application and first book are waiting for Admin review.",
      applicationId
    ),
  ]);

  return { row: await findApplication(env, userId, applicationId) };
}

export async function handleCreatorApplicationRequest(
  request,
  env,
  executionContext
) {
  const authorization = await requireRoles(
    request,
    env,
    ["reader", "author", "admin"],
    executionContext
  );
  if (authorization.response) return authorization.response;

  const userId = authorization.account.profile.user_id;
  const url = new URL(request.url);

  if (url.pathname === "/api/creator-applications/me" && request.method === "GET") {
    return Response.json(serialize(await findApplication(env, userId)));
  }

  if (url.pathname === "/api/creator-applications" && request.method === "POST") {
    const result = await createApplication(env, userId);
    return Response.json(serialize(result.row), {
      status: result.created ? 201 : 200,
    });
  }

  const match = url.pathname.match(
    /^\/api\/creator-applications\/([0-9a-f-]+)(\/submit)?$/i
  );
  if (!match) return jsonError("Not found.", 404);

  const applicationId = match[1];
  if (match[2] === "/submit" && request.method === "POST") {
    const result = await submitApplication(env, userId, applicationId);
    return result.error || Response.json(serialize(result.row));
  }

  if (!match[2] && request.method === "PATCH") {
    let body;
    try {
      body = await readJson(request);
      body = normalizePayload(body);
    } catch (response) {
      return response instanceof Response
        ? response
        : jsonError("Invalid request.", 400);
    }
    const result = await updateDraft(env, userId, applicationId, body);
    return result.error || Response.json(serialize(result.row));
  }

  return jsonError("Method not allowed.", 405);
}
