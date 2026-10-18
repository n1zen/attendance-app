import { cookies } from "next/headers";
import { signToken, verifyToken, type TokenPayload } from "./tokens";

export { signToken, verifyToken, type TokenPayload };

export const ADMIN_COOKIE = "aa_admin";
export const DEVICE_COOKIE = "aa_user";

const WEEK_SECONDS = 60 * 60 * 24 * 7;
const YEAR_SECONDS = 60 * 60 * 24 * 365;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

export async function setAdminCookie(adminId: string): Promise<void> {
  const store = await cookies();
  store.set(
    ADMIN_COOKIE,
    signToken({ id: adminId, exp: Date.now() + WEEK_SECONDS * 1000 }),
    { ...cookieOptions, maxAge: WEEK_SECONDS }
  );
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

export async function setDeviceCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(
    DEVICE_COOKIE,
    signToken({ id: userId, exp: Date.now() + YEAR_SECONDS * 1000 }),
    { ...cookieOptions, maxAge: YEAR_SECONDS }
  );
}

export async function readDeviceToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(DEVICE_COOKIE)?.value;
}

export async function readAdminToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value;
}
