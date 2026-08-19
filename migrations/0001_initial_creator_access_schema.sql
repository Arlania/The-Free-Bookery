PRAGMA foreign_keys = ON;

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reader'
    CHECK (role IN ('reader', 'author', 'admin')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE author_applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'pending',
        'changes_requested',
        'approved',
        'rejected'
      )
    ),
  legal_name TEXT,
  pen_name TEXT,
  biography TEXT,
  website TEXT,
  verification_details TEXT,
  submitted_at TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  admin_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(user_id),
  FOREIGN KEY (reviewed_by) REFERENCES profiles(user_id)
);

CREATE TABLE books (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  application_id TEXT,
  title TEXT NOT NULL,
  author_name TEXT NOT NULL,
  description TEXT,
  isbn TEXT,
  doi TEXT,
  cover_object_key TEXT,
  book_object_key TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'pending',
        'changes_requested',
        'approved',
        'rejected',
        'unpublished'
      )
    ),
  submitted_at TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  admin_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES profiles(user_id),
  FOREIGN KEY (application_id) REFERENCES author_applications(id),
  FOREIGN KEY (reviewed_by) REFERENCES profiles(user_id)
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_record_type TEXT,
  related_record_id TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(user_id)
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES profiles(user_id)
);

CREATE INDEX idx_author_applications_user
  ON author_applications(user_id);

CREATE INDEX idx_author_applications_status
  ON author_applications(status);

CREATE INDEX idx_books_owner
  ON books(owner_user_id);

CREATE INDEX idx_books_status
  ON books(status);

CREATE INDEX idx_notifications_user_read
  ON notifications(user_id, read_at);

CREATE INDEX idx_audit_log_target
  ON audit_log(target_type, target_id);
