"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/members", label: "Members", exact: false },
  { href: "/admin/groups", label: "Groups", exact: false },
  { href: "/admin/analytics", label: "Analytics", exact: false },
  { href: "/admin/settings", label: "Settings", exact: false },
];

function linkClass(active: boolean): string {
  return `whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
    active
      ? "bg-slate-100 text-slate-900"
      : "text-slate-500 hover:text-slate-800"
  }`;
}

/**
 * Streams in behind a Suspense boundary — usePathname() is runtime URL data
 * and cannot be prerendered (esp. on dynamic routes like /admin/members/[id]).
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);
        return (
          <Link key={link.href} href={link.href} className={linkClass(active)}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Prerender-safe fallback: same links, no active state, same layout. */
export function AdminNavFallback() {
  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className={linkClass(false)}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
