ALTER TABLE author_applications ADD COLUMN bulk_delivery_method TEXT
  CHECK (bulk_delivery_method IS NULL OR bulk_delivery_method IN ('link', 'files'));

CREATE TABLE creator_bulk_files (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 10),
  object_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES author_applications(id) ON DELETE CASCADE,
  UNIQUE (application_id, slot)
);

CREATE INDEX idx_creator_bulk_files_application
  ON creator_bulk_files(application_id);

INSERT INTO creator_bulk_files (
  id, application_id, slot, object_key, original_name, content_type, size, uploaded_at
)
SELECT
  lower(hex(randomblob(16))), id, 1, bulk_object_key, bulk_original_name,
  bulk_content_type, bulk_size, COALESCE(bulk_uploaded_at, CURRENT_TIMESTAMP)
FROM author_applications
WHERE bulk_object_key IS NOT NULL;

UPDATE author_applications
SET bulk_delivery_method = CASE
  WHEN bulk_link IS NOT NULL AND trim(bulk_link) != '' THEN 'link'
  WHEN bulk_object_key IS NOT NULL THEN 'files'
  ELSE NULL
END;

