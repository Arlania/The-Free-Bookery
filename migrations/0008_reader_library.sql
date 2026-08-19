CREATE TABLE reader_collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE,
  UNIQUE (user_id, name)
);

CREATE TABLE reader_collection_books (
  collection_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_id, book_id),
  FOREIGN KEY (collection_id) REFERENCES reader_collections(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE reader_starred_books (
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  starred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, book_id),
  FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX idx_reader_collections_user_updated
  ON reader_collections(user_id, updated_at DESC);

CREATE INDEX idx_reader_collection_books_added
  ON reader_collection_books(collection_id, added_at DESC);

CREATE INDEX idx_reader_starred_user_added
  ON reader_starred_books(user_id, starred_at DESC);
