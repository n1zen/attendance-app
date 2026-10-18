import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { logoutAction } from "../actions";
import { AdminNav, AdminNavFallback } from "./nav";

/**
 * Admin chrome (header + nav). Deliberately does NOT read the session here:
 * with Cache Components, session reads belong behind Suspense boundaries,
 * and gating is handled by src/proxy.ts plus requireAdmin() in every action.
 * The nav streams behind Suspense because usePathname() is runtime URL data.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-5">
            <Link
              href="/admin"
              className="flex shrink-0 items-center gap-2 text-sm font-bold tracking-tight text-slate-900"
            >
              AttendanceApp
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
                Admin
              </span>
            </Link>
            <Suspense fallback={<AdminNavFallback />}>
              <AdminNav />
            </Suspense>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="shrink-0 text-sm font-medium text-slate-500 transition hover:text-rose-600"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
