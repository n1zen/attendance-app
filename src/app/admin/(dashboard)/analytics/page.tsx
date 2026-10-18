import Link from "next/link";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import {
  getRangeStats,
  resolveRange,
  todayKey,
  zeroFill,
} from "@/lib/data";
import {
  formatDay,
  formatDayCompact,
  formatDayShort,
} from "@/lib/format";
import {
  btnPrimary,
  btnSecondary,
  btnSmall,
  cardCls,
  inputCls,
  labelCls,
  mutedText,
  pageSubtitleCls,
  pageTitleCls,
} from "@/lib/ui";

// This page renders fresh analytics per request, so it blocks instead of
// prerendering a static shell. See next.config.ts note.
export const instant = false;

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false },
};

/** Long ranges show only days with check-ins to keep the chart readable. */
const DENSE_RANGE_DAYS = 62;

function daysAgo(count: number): string {
  const d = new Date();
  d.setDate(d.getDate() - count);
  return todayKey(d);
}

export default async function AnalyticsPage(
  props: PageProps<"/admin/analytics">
) {
  await connection();
  const sp = await props.searchParams;
  const range = resolveRange(
    Array.isArray(sp.from) ? sp.from[0] : sp.from,
    Array.isArray(sp.to) ? sp.to[0] : sp.to
  );
  const stats = await getRangeStats(range.from, range.to);

  const dense = stats.days > DENSE_RANGE_DAYS;
  const rows = dense
    ? stats.daily.filter((d) => d.count > 0)
    : zeroFill(stats.from, stats.to, stats.daily);
  const peak = rows.reduce((m, r) => Math.max(m, r.count), 0);
  const { niceMax, ticks } = niceScale(peak);
  const labelIdx = labelIndices(rows.length);
  const activeMembers = stats.members.filter((m) => m.checkins > 0);
  const idleMembers = stats.members.length - activeMembers.length;

  const presets = [
    { label: "Today", from: todayKey(), to: todayKey() },
    { label: "Last 7 days", from: daysAgo(6), to: todayKey() },
    { label: "Last 30 days", from: daysAgo(29), to: todayKey() },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className={pageTitleCls}>Analytics</h1>
        <p className={pageSubtitleCls}>
          Attendance by group and member for {formatDayShort(stats.from)} –{" "}
          {formatDayShort(stats.to)} (Philippine time).
        </p>
      </div>

      <form
        method="get"
        action="/admin/analytics"
        className={`${cardCls} flex flex-col gap-3 p-4 sm:flex-row sm:items-end`}
      >
        <div className="flex gap-3">
          <div>
            <label htmlFor="from" className={labelCls}>
              From
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={stats.from}
              className={`${inputCls} sm:w-44`}
            />
          </div>
          <div>
            <label htmlFor="to" className={labelCls}>
              To
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={stats.to}
              className={`${inputCls} sm:w-44`}
            />
          </div>
        </div>
        <button type="submit" className={btnPrimary}>
          Apply
        </button>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {/* Plain anchors (not Links): these trigger downloads, not navigations. */}
          <a
            href={`/admin/analytics/export?format=csv&from=${stats.from}&to=${stats.to}`}
            className={btnSecondary}
            title="Download this range as CSV"
          >
            Export CSV
          </a>
          <a
            href={`/admin/analytics/export?format=xlsx&from=${stats.from}&to=${stats.to}`}
            className={btnSecondary}
            title="Download this range as a detailed Excel workbook"
          >
            Export XLSX
          </a>
          {presets.map((p) => (
            <Link
              key={p.label}
              href={`/admin/analytics?from=${p.from}&to=${p.to}`}
              className={btnSmall}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-4">
        <RangeStat label="Check-ins" value={stats.totalCheckins} />
        <RangeStat label="Active members" value={stats.activeMembers} />
        <RangeStat label="Active groups" value={stats.activeGroups} />
        <RangeStat label="Days in range" value={stats.days} />
      </div>

      <section className={cardCls}>
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Check-ins per day
          </h2>
          <p className="text-xs text-slate-400">
            {dense ? "Days with check-ins only" : "Every day in the range"}
          </p>
        </header>
        {stats.totalCheckins === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No check-ins in this range.
          </p>
        ) : (
          <div className="px-5 pt-5 pb-4">
            {/* Plot: y-axis gutter + gridlines + columns */}
            <div className="flex h-64">
              <div className="relative w-8 shrink-0" aria-hidden>
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="absolute right-2 -translate-y-1/2 text-[10px] font-medium tabular-nums text-slate-400"
                    style={{ top: `${(1 - t / niceMax) * 100}%` }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="relative flex-1">
                {ticks.map((t) => (
                  <div
                    key={t}
                    className="absolute inset-x-0 -translate-y-1/2"
                    style={{ top: `${(1 - t / niceMax) * 100}%` }}
                  >
                    <div
                      className={`h-px ${
                        t === 0 ? "bg-slate-300" : "bg-slate-100"
                      }`}
                    />
                  </div>
                ))}
                <div className="absolute inset-0 flex items-end gap-px sm:gap-0.5">
                  {rows.map((row) => (
                    <div
                      key={row.date}
                      role="img"
                      aria-label={`${formatDay(row.date)}: ${row.count} check-in${
                        row.count === 1 ? "" : "s"
                      }`}
                      className="group relative flex h-full flex-1 items-end hover:z-20"
                    >
                      {row.count > 0 && (
                        <div
                          className="relative w-full"
                          style={{
                            height: `max(2px, ${
                              (row.count / niceMax) * 100
                            }%)`,
                          }}
                        >
                          <div className="h-full w-full rounded-t-sm bg-indigo-500 transition group-hover:bg-indigo-600" />
                          <span
                            aria-hidden
                            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white shadow-sm group-hover:block"
                          >
                            {formatDayCompact(row.date)} · {row.count}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* X-axis date labels, aligned over their columns */}
            <div className="mt-2 flex">
              <div className="w-8 shrink-0" aria-hidden />
              <div className="relative h-4 flex-1">
                {labelIdx.map((j) => (
                  <span
                    key={rows[j].date}
                    className="absolute top-0 text-[10px] text-slate-400"
                    style={labelStyle(j, rows.length)}
                  >
                    {formatDayCompact(rows[j].date)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className={cardCls}>
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">By group</h2>
          <p className="text-xs text-slate-400">
            Check-ins attributed to each member&apos;s current group
          </p>
        </header>
        {stats.groups.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No groups yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3 font-semibold">Group</th>
                <th className="px-5 py-3 text-right font-semibold">Members</th>
                <th className="px-5 py-3 text-right font-semibold">Active</th>
                <th className="px-5 py-3 text-right font-semibold">
                  Check-ins
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.groups.map((group) => (
                <tr key={group.id}>
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {group.name}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                    {group.members}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                    {group.active}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {group.checkins}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={cardCls}>
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">By member</h2>
          <p className="text-xs text-slate-400">
            Most active first — {activeMembers.length} of {stats.members.length}{" "}
            member{stats.members.length === 1 ? "" : "s"} checked in
          </p>
        </header>
        {activeMembers.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No member has checked in within this range.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3 font-semibold">Member</th>
                <th className="px-5 py-3 font-semibold">Group</th>
                <th className="px-5 py-3 font-semibold">Last check-in</th>
                <th className="px-5 py-3 text-right font-semibold">
                  Check-ins
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeMembers.map((member) => (
                <tr key={member.id}>
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/members/${member.id}`}
                      className="font-medium text-slate-900 transition hover:text-indigo-600"
                    >
                      {member.name}
                    </Link>
                    <span className="ml-2 text-xs text-slate-500">
                      “{member.nickname}”
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {member.groupName}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {member.lastDate ? formatDayShort(member.lastDate) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {member.checkins}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {idleMembers > 0 && (
          <p className={`border-t border-slate-100 px-5 py-3 ${mutedText}`}>
            {idleMembers} other member{idleMembers === 1 ? "" : "s"} had no
            check-ins in this range.
          </p>
        )}
      </section>
    </div>
  );
}

function RangeStat({ label, value }: { label: string; value: number }) {
  return (
    <div className={`${cardCls} p-5`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

/** Rounds a tick step up to 1/2/5 × 10ⁿ (integers ≥ 1 for count data). */
function niceStep(x: number): number {
  const exp = Math.floor(Math.log10(x));
  const f = x / 10 ** exp;
  const niceF = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return Math.max(1, niceF * 10 ** exp);
}

/**
 * Y-axis scale for the daily chart: a "nice" max at least the peak, with
 * evenly spaced integer gridlines (about five steps).
 */
function niceScale(peak: number): { niceMax: number; ticks: number[] } {
  const step = niceStep(Math.max(peak, 1) / 5);
  const niceMax = step * Math.max(1, Math.ceil(peak / step));
  const ticks: number[] = [];
  for (let t = 0; t <= niceMax; t += step) ticks.push(t);
  return { niceMax, ticks };
}

/** Which columns get an x-axis label — all when short, evenly spaced when long. */
function labelIndices(n: number): number[] {
  if (n <= 9) return Array.from({ length: n }, (_, i) => i);
  const picks = new Set<number>();
  const k = 7;
  for (let i = 0; i < k; i++) picks.add(Math.round((i * (n - 1)) / (k - 1)));
  return [...picks].sort((a, b) => a - b);
}

/** Positions a label over its column; first/last pin to the plot edges. */
function labelStyle(index: number, n: number): CSSProperties {
  if (index === 0) return { left: 0 };
  if (index === n - 1) return { right: 0 };
  return { left: `${((index + 0.5) / n) * 100}%`, transform: "translateX(-50%)" };
}
