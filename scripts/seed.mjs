/**
 * Demo-data seeder — CONSOLE-ONLY (`npm run seed`); there is no in-app trigger.
 *
 * Creates three sample groups and six members, then fills in attendance for
 * every day from 2026-10-01 through yesterday (Philippine Time) with a
 * deterministic presence pattern — enough data to exercise the dashboard,
 * groups, and analytics filters/charts.
 *
 * Safe to re-run: everything is idempotent (INSERT ... ON CONFLICT DO NOTHING
 * / INSERT OR IGNORE), so existing rows — including real data — are never
 * modified or deleted. Today is never seeded (the range ends yesterday).
 *
 * Targets the same database as the app: `DATABASE_URL` from the environment or
 * `.env.local` if set (file path locally, libsql:// + TURSO_AUTH_TOKEN for
 * hosted), otherwise the default local SQLite file.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";

const START = "2026-10-01";
const TIME_ZONE = "Asia/Manila"; // the app's timezone — day keys are PHT

/* ----------------------------- environment ----------------------------- */

/** Minimal .env.local reader (KEY=VALUE lines; real env wins). */
function loadDotEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith("#")) continue;
      const value = m[2].replace(/^["']|["']$/g, "");
      if (value && !(m[1] in process.env)) process.env[m[1]] = value;
    }
  } catch {
    /* no .env.local — fine */
  }
}

/** Mirrors the app's URL resolution (src/lib/db.ts). */
function resolveDbUrl() {
  const raw = process.env.DATABASE_URL?.trim();
  return !raw
    ? `file:${path.join(homedir(), ".attendanceapp", "app.db")}`
    : raw.includes("://")
      ? raw
      : `file:${path.resolve(raw)}`;
}

/* -------------------------------- dates -------------------------------- */

/** Philippine calendar day as YYYY-MM-DD (same helper as the app). */
const dayKey = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

/** Deterministic per-(day, member) value, so re-seeds always agree. */
function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* ------------------------------- seeding ------------------------------- */

// Keep in sync with SCHEMA in src/lib/db.ts (idempotent, so both can coexist).
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

const GROUPS = ["Morning Shift", "Afternoon Shift", "Evening Shift"];

// [full name, nickname, group index] — demo personas, ~70% attendance.
const MEMBERS = [
  ["Ana Dela Cruz", "ana", 0],
  ["Ben Ramos", "benny", 0],
  ["Carla Villanueva", "carlav", 1],
  ["Diego Gonzales", "diego", 1],
  ["Elena Reyes", "elena", 2],
  ["Francis Lim", "francis", 2],
];

/** ~70% of members present on any given day, same on every run. */
const PRESENCE_MODULUS = 10;
const PRESENCE_THRESHOLD = 7;

async function main() {
  loadDotEnv();
  const db = createClient({
    url: resolveDbUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });
  await db.batch(SCHEMA, "write");

  const today = dayKey(new Date());
  // "Yesterday" in Philippine Time, computed from today's PHT key.
  const yesterday = dayKey(
    new Date(new Date(`${today}T12:00:00Z`).getTime() - 86_400_000)
  );
  if (yesterday < START) {
    console.log(`Nothing to seed: the range starts on ${START} (today is ${today}).`);
    return;
  }

  // Groups (skip ones that already exist under the same name).
  const groupIds = [];
  for (const name of GROUPS) {
    const key = name.toLowerCase();
    await db.execute({
      sql: "INSERT INTO groups (name, name_key, created_at) VALUES (?, ?, ?) ON CONFLICT(name_key) DO NOTHING",
      args: [name, key, new Date().toISOString()],
    });
    const rs = await db.execute({
      sql: "SELECT id FROM groups WHERE name_key = ?",
      args: [key],
    });
    groupIds.push(Number(rs.rows[0].id));
  }

  // Members (skip nicknames already taken — e.g. previously seeded).
  const members = [];
  for (const [name, nickname, groupIndex] of MEMBERS) {
    const key = nickname.toLowerCase();
    await db.execute({
      sql: `INSERT OR IGNORE INTO users
            (name, nickname, nickname_key, group_id, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [name, nickname, key, groupIds[groupIndex], new Date().toISOString()],
    });
    const rs = await db.execute({
      sql: "SELECT id FROM users WHERE nickname_key = ?",
      args: [key],
    });
    members.push({ id: Number(rs.rows[0].id), nickname: key });
  }

  // Attendance: START .. yesterday (PHT), ~70% presence per (day, member).
  const statements = [];
  let days = 0;
  const cur = new Date(`${START}T12:00:00Z`);
  const end = new Date(`${yesterday}T12:00:00Z`);
  while (cur.getTime() <= end.getTime()) {
    const date = cur.toISOString().slice(0, 10);
    days++;
    for (const member of members) {
      const h = hash(`${date}:${member.nickname}`);
      if (h % PRESENCE_MODULUS >= PRESENCE_THRESHOLD) continue; // absent
      // A plausible PHT morning/afternoon check-in time (08:00–16:59 PHT).
      const hourUtc = String(h % 9).padStart(2, "0"); // 00:00–08:00 UTC
      const minute = String((h >> 4) % 60).padStart(2, "0");
      statements.push({
        sql: `INSERT INTO attendance (user_id, date, created_at)
              VALUES (?, ?, ?) ON CONFLICT (user_id, date) DO NOTHING`,
        args: [member.id, date, `${date}T${hourUtc}:${minute}:00.000Z`],
      });
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const results = await db.batch(statements, "write");
  const inserted = results.reduce((sum, r) => sum + r.rowsAffected, 0);
  const skipped = statements.length - inserted;

  console.log(`Seeded demo data up to ${yesterday} (${TIME_ZONE}).`);
  console.log(`  Range:          ${START} .. ${yesterday} (${days} days)`);
  console.log(`  Groups:         ${GROUPS.length} (already-present ones reused)`);
  console.log(`  Members:        ${members.length} (~70% attendance each day)`);
  console.log(`  Check-ins:      ${inserted} inserted, ${skipped} already present`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exitCode = 1;
});
