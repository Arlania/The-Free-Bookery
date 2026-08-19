import Database from "better-sqlite3";
import { betterAuth } from "better-auth";

// CLI-only configuration used to generate Better Auth's SQLite/D1 schema.
// The deployed Worker uses src/auth.js with the Cloudflare D1 binding.
export const auth = betterAuth({
  database: new Database(":memory:"),
  emailAndPassword: {
    enabled: true,
  },
});
