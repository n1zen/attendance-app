import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@/lib/tokens";

/**
 * Optimistic gate for the admin area: verifies the signed session cookie
 * (no database access) and bounces visitors to the login page.
 *
 * Every admin Server Action re-verifies the session against the database
 * via requireAdmin() — this proxy is convenience, not the security boundary.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("aa_admin")?.value;
  const authed = verifyToken(token) !== null;
  const isLogin = pathname === "/admin/login";

  if (!authed && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (authed && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
