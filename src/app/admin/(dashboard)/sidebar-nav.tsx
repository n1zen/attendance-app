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
  return `flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
    active
      ? "bg-indigo-50 text-indigo-700"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
  }`;
}

/**
 * Vertical nav shared by the desktop sidebar and the mobile menu.
 * Streams in behind a Suspense boundary — usePathname() is runtime URL data
 * and cannot be prerendered (esp. on dynamic routes like /admin/members/[id]).
 */
export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
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
export function SidebarNavFallback() {
  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className={linkClass(false)}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
