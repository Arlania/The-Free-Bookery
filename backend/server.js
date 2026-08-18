const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const port = 3000;

const databasePath = path.join(__dirname, "database", "freebooknook.db");
const database = new Database(databasePath);
const authDatabasePath = path.join(__dirname, "database", "auth.db");
const authDatabase = new Database(authDatabasePath);
const privateBooksPath = path.join(__dirname, "private-books");
const sessions = new Map();

authDatabase.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'creator', 'admin')),
    creator_status TEXT NOT NULL DEFAULT 'none',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const separator = cookie.indexOf("=");
        return [
          decodeURIComponent(cookie.slice(0, separator)),
          decodeURIComponent(cookie.slice(separator + 1)),
        ];
      })
  );
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function passwordMatches(password, user) {
  const candidate = Buffer.from(hashPassword(password, user.password_salt), "hex");
  const expected = Buffer.from(user.password_hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function getSession(request) {
  const token = parseCookies(request).freebookery_session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function publicSession(session) {
  return {
    authenticated: true,
    name: session.name,
    role: session.role,
    effectiveRole: session.effectiveRole,
    creatorStatus:
      session.effectiveRole === "creator" || session.effectiveRole === "admin"
        ? "approved"
        : "none",
  };
}

app.use(express.json());

// Serve the current HTML, CSS, JavaScript, and asset files.
const frontendPath = path.join(__dirname, "..");

app.use(
  "/vendor/pdfjs",
  express.static(path.join(frontendPath, "node_modules", "pdfjs-dist", "build"))
);

app.use(["/backend", "/books", "/node_modules"], (request, response) => {
  response.status(404).send("Not found");
});

app.use(express.static(frontendPath));

app.post("/api/auth/login", (request, response) => {
  const accountName = String(request.body?.accountName || "").trim();
  const password = String(request.body?.password || "");

  if (!accountName || !password || accountName.length > 100 || password.length > 256) {
    return response.status(401).json({ error: "Invalid account name or password." });
  }

  const user = authDatabase
    .prepare(
      `SELECT id, account_name, password_salt, password_hash, role, creator_status
       FROM users WHERE account_name = ?`
    )
    .get(accountName);

  if (!user || !passwordMatches(password, user)) {
    return response.status(401).json({ error: "Invalid account name or password." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const session = {
    userId: user.id,
    name: user.account_name,
    role: user.role,
    effectiveRole: user.role,
    expiresAt: Date.now() + 1000 * 60 * 60 * 12,
  };
  sessions.set(token, session);

  response.setHeader(
    "Set-Cookie",
    `freebookery_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`
  );
  response.json(publicSession(session));
});

app.get("/api/auth/session", (request, response) => {
  const session = getSession(request);
  if (!session) return response.json({ authenticated: false });
  response.json(publicSession(session));
});

app.post("/api/auth/logout", (request, response) => {
  const token = parseCookies(request).freebookery_session;
  if (token) sessions.delete(token);
  response.setHeader(
    "Set-Cookie",
    "freebookery_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"
  );
  response.json({ success: true });
});

app.post("/api/admin/role", (request, response) => {
  const session = getSession(request);
  if (!session || session.role !== "admin") {
    return response.status(403).json({ error: "Forbidden." });
  }

  const effectiveRole = String(request.body?.role || "");
  if (!["reader", "creator", "admin"].includes(effectiveRole)) {
    return response.status(400).json({ error: "Invalid role." });
  }

  session.effectiveRole = effectiveRole;
  response.json(publicSession(session));
});

app.get("/api/books/search", (request, response) => {
  const query = String(request.query.q || "").trim();

  if (!query) {
    return response.json([]);
  }

  const searchValue = `%${query}%`;

  const books = database
    .prepare(`
      SELECT
        id,
        title,
        author,
        description,
        format,
        isbn,
        doi,
        cover_url,
        CASE
          WHEN file_url IS NOT NULL AND file_url != '' THEN 1
          ELSE 0
        END AS has_file
      FROM books
      WHERE status = 'approved'
        AND (
          title LIKE ?
          OR author LIKE ?
          OR isbn LIKE ?
          OR doi LIKE ?
        )
      ORDER BY title
      LIMIT 50
    `)
    .all(searchValue, searchValue, searchValue, searchValue);

  response.json(books);
});

app.get("/api/books/:id", (request, response) => {
  const bookId = Number.parseInt(request.params.id, 10);

  if (!Number.isInteger(bookId) || bookId < 1) {
    return response.status(400).json({ error: "Invalid book ID." });
  }

  const book = database
    .prepare(`
      SELECT
        id,
        title,
        author,
        description,
        isbn,
        doi,
        cover_url,
        CASE
          WHEN file_url IS NOT NULL AND file_url != '' THEN 1
          ELSE 0
        END AS has_file
      FROM books
      WHERE id = ? AND status = 'approved'
    `)
    .get(bookId);

  if (!book) {
    return response.status(404).json({ error: "Book not found." });
  }

  response.json(book);
});

app.get("/api/books/:id/read", (request, response) => {
  const bookId = Number.parseInt(request.params.id, 10);

  if (!Number.isInteger(bookId) || bookId < 1) {
    return response.status(400).json({ error: "Invalid book ID." });
  }

  const book = database
    .prepare(`
      SELECT title, file_url
      FROM books
      WHERE id = ? AND status = 'approved'
    `)
    .get(bookId);

  if (!book?.file_url) {
    return response.status(404).json({ error: "Book file not found." });
  }

  const filename = path.basename(book.file_url);
  const pdfPath = path.join(privateBooksPath, filename);

  if (path.extname(filename).toLowerCase() !== ".pdf" || !fs.existsSync(pdfPath)) {
    return response.status(404).json({ error: "Book file not found." });
  }

  response.set({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Disposition": `inline; filename="${filename}"`,
    "X-Content-Type-Options": "nosniff",
  });
  response.sendFile(pdfPath);
});

app.listen(port, () => {
  console.log(`Free Bookery is running at http://localhost:${port}`);
});
