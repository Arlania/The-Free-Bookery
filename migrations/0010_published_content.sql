PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS published_content (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('blog', 'newsletter')),
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT NOT NULL,
  category TEXT,
  published_by TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (published_by) REFERENCES profiles(user_id)
);

CREATE INDEX IF NOT EXISTS idx_published_content_type_date
  ON published_content(content_type, published_at DESC);
