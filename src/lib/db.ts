import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";

/**
 * SQLite, accessed through the libSQL client:
 *
 * - Local development uses a plain database file — nothing to install or run.
 *   The default location is `~/.attendanceapp/app.db`; override it with
 *   `DATABASE_URL` (`file:...` for a file, or a bare path).
 * - Vercel's serverless filesystem is ephemeral, so a deployed instance must
 *   point `DATABASE_URL` (+ `TURSO_AUTH_TOKEN`) at a hosted libSQL database
 *   (Turso) for data to persist.
 *
 * `@libsql/client` ships native bindings for `file:` URLs. It is in Next's
 * default `serverExternalPackages` list, so they are not bundled.
 */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS groups (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     name_key TEXT NOT NULL UNIQUE,
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     nickname TEXT NOT NULL,
     nickname_key TEXT NOT NULL UNIQUE,
     group_id INTEGER NOT NULL REFERENCES groups(id),
     created_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_users_group_id ON users(group_id)`,
  `CREATE TABLE IF NOT EXISTS attendance (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL REFERENCES users(id),
     date TEXT NOT NULL,
     created_at TEXT NOT NULL,
     UNIQUE (user_id, date)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_attendance_date_created
     ON attendance(date, created_at)`,
  `CREATE TABLE IF NOT EXISTS admins (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     username TEXT NOT NULL,
     username_key TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     created_at TEXT NOT NULL
   )`,
];

/** Best-effort `file:` URL -> filesystem path, for creating the parent dir. */
function fileUrlToPath(url: string): string {
  let p = decodeURIComponent(url.slice("file:".length));
  // Windows form "file:///C:/..." -> "C:/..."
  if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
  return p;
}

async function resolveDbUrl(): Promise<string> {
  const raw = process.env.DATABASE_URL?.trim();
  const url = !raw
    ? `file:${path.join(homedir(), ".attendanceapp", "app.db")}`
    : raw.includes("://")
      ? raw // file:/file: URLs and libsql:// remote hosts
      : `file:${path.resolve(raw)}`; // bare path shorthand
  if (url.startsWith("file:")) {
    await mkdir(path.dirname(fileUrlToPath(url)), { recursive: true });
  }
  return url;
}

declare global {
  var __attendanceDb: Promise<Client> | undefined;
}

/**
 * Returns the shared libSQL client, creating it (and applying the idempotent
 * schema) on first use. Cached on `globalThis` to survive dev-server HMR
 * reloads; cleared automatically when client creation fails, so a transient
 * error doesn't poison every later request.
 */
export function getDb(): Promise<Client> {
  if (!globalThis.__attendanceDb) {
    globalThis.__attendanceDb = (async () => {
      const client = createClient({
        url: await resolveDbUrl(),
        authToken: process.env.TURSO_AUTH_TOKEN || undefined,
      });
      await client.batch(SCHEMA, "write");
      return client;
    })().catch((err) => {
      globalThis.__attendanceDb = undefined;
      throw err;
    });
  }
  return globalThis.__attendanceDb;
}
