ALTER TABLE author_applications ADD COLUMN social_links TEXT NOT NULL DEFAULT '[]';
ALTER TABLE author_applications ADD COLUMN no_online_presence INTEGER NOT NULL DEFAULT 0
  CHECK (no_online_presence IN (0, 1));
ALTER TABLE author_applications ADD COLUMN submission_mode TEXT NOT NULL DEFAULT 'individual'
  CHECK (submission_mode IN ('individual', 'bulk'));
ALTER TABLE author_applications ADD COLUMN policy_confirmation INTEGER NOT NULL DEFAULT 0
  CHECK (policy_confirmation IN (0, 1));
ALTER TABLE author_applications ADD COLUMN bulk_link TEXT;
ALTER TABLE author_applications ADD COLUMN bulk_object_key TEXT;
ALTER TABLE author_applications ADD COLUMN bulk_original_name TEXT;
ALTER TABLE author_applications ADD COLUMN bulk_content_type TEXT;
ALTER TABLE author_applications ADD COLUMN bulk_size INTEGER;
ALTER TABLE author_applications ADD COLUMN bulk_uploaded_at TEXT;

ALTER TABLE books ADD COLUMN book_type TEXT
  CHECK (book_type IS NULL OR book_type IN ('fiction', 'nonfiction'));
ALTER TABLE books ADD COLUMN source_url TEXT;
