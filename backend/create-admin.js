const crypto = require("crypto");
const path = require("path");
const Database = require("better-sqlite3");

const accountName = process.env.FREEBOOKERY_ADMIN_NAME;
const password = process.env.FREEBOOKERY_ADMIN_PASSWORD;

if (!accountName || !password) {
  console.error(
    "Set FREEBOOKERY_ADMIN_NAME and FREEBOOKERY_ADMIN_PASSWORD before running this command."
  );
  process.exit(1);
}

const databasePath = path.join(__dirname, "database", "auth.db");
const database = new Database(databasePath);
const salt = crypto.randomBytes(16).toString("hex");
const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");

database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'creator', 'admin')),
    creator_status TEXT NOT NULL DEFAULT 'none',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

database
  .prepare(
    `INSERT INTO users (account_name, password_salt, password_hash, role, creator_status)
     VALUES (?, ?, ?, 'admin', 'approved')
     ON CONFLICT(account_name) DO UPDATE SET
       password_salt = excluded.password_salt,
       password_hash = excluded.password_hash,
       role = 'admin',
       creator_status = 'approved'`
  )
  .run(accountName, salt, passwordHash);

database.close();
console.log("Administrator account created or updated.");
