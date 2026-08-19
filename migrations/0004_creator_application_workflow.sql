ALTER TABLE author_applications ADD COLUMN creator_type TEXT NOT NULL DEFAULT 'author'
  CHECK (creator_type IN ('author', 'publisher'));
ALTER TABLE author_applications ADD COLUMN rights_confirmation INTEGER NOT NULL DEFAULT 0
  CHECK (rights_confirmation IN (0, 1));

ALTER TABLE books ADD COLUMN subtitle TEXT;
ALTER TABLE books ADD COLUMN language TEXT NOT NULL DEFAULT 'English';
ALTER TABLE books ADD COLUMN series_name TEXT;
ALTER TABLE books ADD COLUMN edition TEXT;
ALTER TABLE books ADD COLUMN contributors TEXT;
ALTER TABLE books ADD COLUMN categories TEXT;
ALTER TABLE books ADD COLUMN keywords TEXT;
ALTER TABLE books ADD COLUMN reading_age TEXT;
ALTER TABLE books ADD COLUMN explicit_content INTEGER NOT NULL DEFAULT 0
  CHECK (explicit_content IN (0, 1));
ALTER TABLE books ADD COLUMN territories TEXT NOT NULL DEFAULT 'Worldwide';
ALTER TABLE books ADD COLUMN accessibility_notes TEXT;
ALTER TABLE books ADD COLUMN rights_statement TEXT;

CREATE UNIQUE INDEX idx_one_active_author_application_per_user
  ON author_applications(user_id)
  WHERE status IN ('draft', 'pending', 'changes_requested', 'approved');
