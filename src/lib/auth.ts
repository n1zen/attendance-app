import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { getDb } from "./db";
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

/** Creates the default admin account when the admins collection is empty. */
export async function ensureAdminSeeded(): Promise<void> {
  const db = await getDb();
  const admins = db.collection("admins");
  const count = await admins.countDocuments();
  if (count > 0) return;
  await admins.insertOne({
    username: DEFAULT_ADMIN_USERNAME,
    usernameKey: DEFAULT_ADMIN_USERNAME.toLowerCase(),
    passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
    createdAt: new Date(),
  });
  console.warn(
    `[attendance] Seeded default admin "${DEFAULT_ADMIN_USERNAME}" with the default password. Change it.`
  );
}

/**
 * Resolves the signed admin cookie to a live admin account (checks the DB).
 * Returns null when the cookie is missing, invalid, expired, or the account
 * no longer exists.
 */
export async function getAdmin(): Promise<AdminSession | null> {
  const payload = verifyToken(await readAdminToken());
  if (!payload) return null;
  if (!ObjectId.isValid(payload.id)) return null;

  const db = await getDb();
  const admin = await db
    .collection("admins")
    .findOne({ _id: new ObjectId(payload.id) });
  if (!admin) return null;
  return { id: admin._id.toString(), username: admin.username };
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
