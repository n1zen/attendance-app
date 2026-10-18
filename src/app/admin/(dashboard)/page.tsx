import type { Metadata } from "next";
import { connection } from "next/server";
import { getTodayCheckIns, getTodayStats } from "@/lib/data";
import {
  cardCls,
  pageSubtitleCls,
  pageTitleCls,
} from "@/lib/ui";
import { AutoRefresh, QrPanel } from "./dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false },
};

// This page renders fresh data from SQLite on every request, so it blocks
// instead of prerendering a static shell. See next.config.ts note.
export const instant = false;

export default async function AdminDashboard() {
  await connection();
  const [stats, entries] = await Promise.all([
    getTodayStats(),
    getTodayCheckIns(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={pageTitleCls}>Dashboard</h1>
          <p className={pageSubtitleCls}>
            Today&apos;s attendance, live — refreshed automatically.
          </p>
        </div>
        <AutoRefresh seconds={15} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Present today"
          value={`${stats.present}`}
          detail={`of ${stats.total} member${stats.total === 1 ? "" : "s"} · ${stats.date}`}
          accent
        />
        <StatCard
          label="Total members"
          value={`${stats.total}`}
          detail="registered so far"
        />
        <StatCard
          label="Groups"
          value={`${stats.groups}`}
          detail={stats.groups === 1 ? "1 group" : "active groups"}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <section className={cardCls}>
            <header className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Checked in today
              </h2>
              <p className="text-xs text-slate-400">Newest first</p>
            </header>

            {entries.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                No check-ins yet today. The list fills up as people scan.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <span className="w-12 shrink-0 rounded-md bg-slate-100 px-1.5 py-1 text-center text-xs font-semibold tabular-nums text-slate-600">
                      {entry.time}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {entry.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        “{entry.nickname}”
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                      {entry.groupName}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div className="lg:col-span-2">
          <QrPanel />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className={`${cardCls} p-5`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-bold tracking-tight ${
          accent ? "text-indigo-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
