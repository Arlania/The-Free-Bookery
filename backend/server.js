const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 3000;

const databasePath = path.join(__dirname, "database", "freebooknook.db");
const database = new Database(databasePath);
const privateBooksPath = path.join(__dirname, "private-books");

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
