CREATE TABLE platform_owners (
  user_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(user_id)
);

CREATE TABLE owner_view_preferences (
  user_id TEXT PRIMARY KEY,
  view_as_role TEXT NOT NULL DEFAULT 'admin'
    CHECK (view_as_role IN ('reader', 'author', 'admin')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES platform_owners(user_id) ON DELETE CASCADE
);
