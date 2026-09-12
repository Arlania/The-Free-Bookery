PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS blog_submissions (
  id TEXT PRIMARY KEY,
  author_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'changes_requested', 'approved', 'rejected')),
  admin_message TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  published_content_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_user_id) REFERENCES profiles(user_id),
  FOREIGN KEY (reviewed_by) REFERENCES profiles(user_id),
  FOREIGN KEY (published_content_id) REFERENCES published_content(id)
);

CREATE INDEX IF NOT EXISTS idx_blog_submissions_author_date
  ON blog_submissions(author_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_submissions_status_date
  ON blog_submissions(status, created_at ASC);
