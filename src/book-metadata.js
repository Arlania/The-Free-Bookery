const allowedRightsBases = new Set(["owned_or_administered", "public_domain"]);

export function normalizeIsbn(value) {
  return String(value || "")
    .replace(/^isbn(?:-1[03])?:?/i, "")
    .replace(/[\s-]+/g, "")
    .toUpperCase();
}

export function isbnIsValid(value) {
  const isbn = normalizeIsbn(value);
  if (!isbn) return true;
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const total = [...isbn].reduce((sum, character, index) => {
      const digit = character === "X" ? 10 : Number(character);
      return sum + digit * (10 - index);
    }, 0);
    return total % 11 === 0;
  }
  if (/^\d{13}$/.test(isbn)) {
    const total = [...isbn.slice(0, 12)].reduce(
      (sum, character, index) => sum + Number(character) * (index % 2 ? 3 : 1),
      0
    );
    return (10 - (total % 10)) % 10 === Number(isbn[12]);
  }
  return false;
}

export function normalizeDoi(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim()
    .toLowerCase();
}

export function doiIsValid(value) {
  const doi = normalizeDoi(value);
  return !doi || /^10\.\d{4,9}\/\S+$/i.test(doi);
}

export function normalizeRightsBasis(value) {
  const basis = String(value || "").trim();
  return allowedRightsBases.has(basis) ? basis : "";
}

export function categoriesAreValid(value) {
  const categories = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return categories.length > 0 && categories.length <= 3;
}

export function websiteIsValid(value) {
  const website = String(value || "").trim();
  if (!website) return true;
  try {
    const url = new URL(website);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function findDuplicateBooks(env, book) {
  const clauses = [];
  const bindings = [];
  if (book.isbn_normalized) {
    clauses.push("isbn_normalized = ?");
    bindings.push(book.isbn_normalized);
  }
  if (book.doi_normalized) {
    clauses.push("doi_normalized = ?");
    bindings.push(book.doi_normalized);
  }
  if (!clauses.length) return [];

  const result = await env.DB.prepare(
    `SELECT id, title, author_name, isbn, doi, status
     FROM books
     WHERE id != ?
       AND status NOT IN ('rejected', 'unpublished')
       AND (${clauses.join(" OR ")})
     ORDER BY CASE status WHEN 'approved' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
              created_at ASC
     LIMIT 20`
  ).bind(book.id, ...bindings).all();
  return result.results || [];
}

export async function storedBookFilesExist(env, book) {
  if (!book.book_object_key || !book.cover_object_key) return false;
  const [manuscript, cover] = await Promise.all([
    env.PRIVATE_BOOK_FILES.head(book.book_object_key),
    env.PRIVATE_BOOK_FILES.head(book.cover_object_key),
  ]);
  return Boolean(manuscript && cover);
}
