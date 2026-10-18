import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { parseId } from "./data";
import { readAdminToken, verifyToken } from "./session";

export type AdminSession = { id: string; username: string };

export const DEFAULT_ADMIN_USERNAME = "admin";
export const DEFAULT_ADMIN_PASSWORD = "admin123";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const derived = scryptSync(password, salt, expected.length);
  return (
    derived.length === expected.length && timingSafeEqual(derived, expected)
  );
}

/** Creates the default admin account when the admins table is empty. */
export async function ensureAdminSeeded(): Promise<void> {
  const db = await getDb();
  // Single conditional insert: concurrent first logins can't double-seed.
  const result = await db.execute({
    sql: `INSERT INTO admins (username, username_key, password_hash, created_at)
          SELECT ?, ?, ?, ?
          WHERE NOT EXISTS (SELECT 1 FROM admins)`,
    args: [
      DEFAULT_ADMIN_USERNAME,
      DEFAULT_ADMIN_USERNAME.toLowerCase(),
      hashPassword(DEFAULT_ADMIN_PASSWORD),
      new Date().toISOString(),
    ],
  });
  if (result.rowsAffected > 0) {
    console.warn(
      `[attendance] Seeded default admin "${DEFAULT_ADMIN_USERNAME}" with the default password. Change it.`
    );
  }
}

/**
 * Resolves the signed admin cookie to a live admin account (checks the DB).
 * Returns null when the cookie is missing, invalid, expired, or the account
 * no longer exists.
 */
export async function getAdmin(): Promise<AdminSession | null> {
  const payload = verifyToken(await readAdminToken());
  const id = payload ? parseId(payload.id) : null;
  if (id === null) return null;

  const db = await getDb();
  const rs = await db.execute({
    sql: "SELECT username FROM admins WHERE id = ?",
    args: [id],
  });
  const row = rs.rows[0];
  if (!row) return null;
  return { id: String(id), username: String(row.username) };
}

/**
 * Authorization guard for every admin Server Action. Server Actions are
 * reachable via direct POST requests, so re-verify the session close to the
 * data instead of trusting the client. Redirects to the login page when the
 * caller is not an admin.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
