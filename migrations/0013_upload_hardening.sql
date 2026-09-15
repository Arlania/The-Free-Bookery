PRAGMA foreign_keys = ON;

ALTER TABLE books ADD COLUMN isbn_normalized TEXT;
ALTER TABLE books ADD COLUMN doi_normalized TEXT;
ALTER TABLE books ADD COLUMN rights_basis TEXT;
ALTER TABLE books ADD COLUMN manuscript_validation TEXT;

UPDATE books
SET isbn_normalized = lower(replace(replace(trim(isbn), '-', ''), ' ', ''))
WHERE isbn IS NOT NULL AND trim(isbn) != '';

UPDATE books
SET doi_normalized = lower(
  replace(replace(replace(lower(trim(doi)), 'https://doi.org/', ''), 'http://doi.org/', ''), 'doi:', '')
)
WHERE doi IS NOT NULL AND trim(doi) != '';

UPDATE books
SET rights_basis = 'owned_or_administered'
WHERE rights_statement IS NOT NULL AND trim(rights_statement) != '';

UPDATE books SET territories = 'Worldwide';

UPDATE books
SET manuscript_validation = 'legacy'
WHERE book_object_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_books_isbn_normalized
  ON books(isbn_normalized);

CREATE INDEX IF NOT EXISTS idx_books_doi_normalized
  ON books(doi_normalized);
