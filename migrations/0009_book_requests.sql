CREATE TABLE book_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  author_name TEXT,
  isbn TEXT,
  requested_format TEXT NOT NULL DEFAULT 'any'
    CHECK (requested_format IN ('any', 'pdf', 'epub')),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'researching', 'contacting', 'acquired', 'fulfilled',
      'unavailable', 'rejected', 'canceled'
    )),
  admin_message TEXT,
  fulfilled_book_id TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE,
  FOREIGN KEY (fulfilled_book_id) REFERENCES books(id),
  FOREIGN KEY (reviewed_by) REFERENCES profiles(user_id)
);

CREATE INDEX idx_book_requests_user_created
  ON book_requests(user_id, created_at DESC);

CREATE INDEX idx_book_requests_status_created
  ON book_requests(status, created_at ASC);

CREATE INDEX idx_book_requests_title_author
  ON book_requests(title COLLATE NOCASE, author_name COLLATE NOCASE);
