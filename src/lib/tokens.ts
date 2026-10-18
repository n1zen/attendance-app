import { createHmac, timingSafeEqual } from "node:crypto";

export type TokenPayload = { id: string; exp: number };

const VERSION = "v1";

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error(
      "SESSION_SECRET is not set. Copy .env.example to .env.local and set a random value."
    );
  }
  return value;
}

function signature(signedBody: string): string {
  return createHmac("sha256", secret()).update(signedBody).digest("base64url");
}

export function signToken(payload: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signedBody = `${VERSION}.${body}`;
  return `${signedBody}.${signature(signedBody)}`;
}

/** Verifies the HMAC signature and expiry. Returns null when invalid. */
export function verifyToken(
  token: string | undefined,
  now: number = Date.now()
): TokenPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [version, body, sig] = parts;
  if (version !== VERSION) return null;

  const expected = Buffer.from(signature(`${version}.${body}`));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as TokenPayload;
    if (typeof payload.id !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}
