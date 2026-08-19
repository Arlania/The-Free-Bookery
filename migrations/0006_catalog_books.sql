ALTER TABLE books ADD COLUMN public_cover_url TEXT;

INSERT OR IGNORE INTO profiles (user_id, display_name, role)
VALUES ('system-catalog', 'Free Bookery Catalog', 'admin');

INSERT OR IGNORE INTO books (
  id, owner_user_id, title, author_name, description, isbn, status
) VALUES
  ('1', 'system-catalog', 'Pride and Prejudice', 'Jane Austen',
   'A classic novel about family, society, and relationships.', '9780141439518', 'approved'),
  ('2', 'system-catalog', 'Frankenstein', 'Mary Shelley',
   'A scientist creates a living being with tragic consequences.', '9780141439471', 'approved'),
  ('3', 'system-catalog', 'The Art of War', 'Sun Tzu',
   'An ancient work about strategy and leadership.', '9781599869773', 'approved');

INSERT OR IGNORE INTO books (
  id, owner_user_id, title, author_name, description, isbn,
  public_cover_url, book_object_key, manuscript_original_name,
  manuscript_content_type, status
) VALUES (
  '4', 'system-catalog', 'Alice''s Adventures in Wonderland', 'Lewis Carroll',
  'Alice follows a white rabbit into a strange fantasy world.', '9781503222687',
  'assets/covers/alice-in-wonderland.jpeg',
  'catalog/alice_in_wonderland.pdf', 'alice_in_wonderland.pdf',
  'application/pdf', 'approved'
);

CREATE INDEX IF NOT EXISTS idx_books_catalog_search
  ON books(status, title, author_name, isbn, doi);
