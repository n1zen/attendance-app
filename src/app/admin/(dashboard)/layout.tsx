import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { APP_NAME } from "@/lib/app-name";
import { logoutAction } from "../actions";
import { SidebarNav, SidebarNavFallback } from "./sidebar-nav";

/**
 * Admin chrome: a fixed left sidebar on desktop, and a sticky top bar with a
 * CSS-only (<details>) menu on mobile — no client state, so navigation keeps
 * working without JS. Deliberately does NOT read the session here: with
 * Cache Components, session reads belong behind Suspense boundaries, and
 * gating is handled by src/proxy.ts plus requireAdmin() in every action.
 * The nav streams behind Suspense because usePathname() is runtime URL data.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="px-4 py-5">
          <BrandLink />
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <Suspense fallback={<SidebarNavFallback />}>
            <SidebarNav />
          </Suspense>
        </div>

        <div className="border-t border-slate-100 p-3">
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar + CSS-only menu */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <BrandLink />
          <details className="group relative">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 [&::-webkit-details-marker]:hidden">
              <span className="sr-only">Menu</span>
              <svg
                className="block h-5 w-5 group-open:hidden"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Zm0-5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z"
                  clipRule="evenodd"
                />
              </svg>
              <svg
                className="hidden h-5 w-5 group-open:block"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden
              >
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </summary>

            <nav className="absolute right-0 top-full hidden w-60 border-b border-slate-200 bg-white p-3 shadow-xl group-open:block">
              <Suspense fallback={<SidebarNavFallback />}>
                <SidebarNav />
              </Suspense>
              <form
                action={logoutAction}
                className="mt-2 border-t border-slate-100 pt-2"
              >
                <button
                  type="submit"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                >
                  Sign out
                </button>
              </form>
            </nav>
          </details>
        </div>
      </div>

      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-6xl px-4 py-8">{children}</div>
      </main>
    </div>
  );
}

function BrandLink() {
  return (
    <Link
      href="/admin"
      className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-900"
    >
      {APP_NAME}
      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
        Admin
      </span>
    </Link>
  );
}
