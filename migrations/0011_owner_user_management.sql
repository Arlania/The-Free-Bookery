ALTER TABLE profiles ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at);
