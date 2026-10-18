import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getMember, getMemberAttendance } from "@/lib/data";
import {
  cardCls,
  pageSubtitleCls,
  pageTitleCls,
} from "@/lib/ui";

// This page renders fresh data on every request (MongoDB), so it blocks
// instead of prerendering a static shell. See next.config.ts note.
export const instant = false;

export const metadata: Metadata = {
  title: "Member",
  robots: { index: false },
};

export default async function MemberDetailPage(
  props: PageProps<"/admin/members/[id]">
) {
  await connection();
  const { id } = await props.params;

  const member = await getMember(id);
  if (!member) notFound();

  const attendance = await getMemberAttendance(id);

  const joined = new Date(member.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/members"
          className="text-sm font-medium text-indigo-600 transition hover:text-indigo-500"
        >
          ← Back to members
        </Link>

        <div className="mt-3 grid items-start gap-6 lg:grid-cols-3">
          <section className={`${cardCls} p-5 lg:col-span-1`}>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-700"
              >
                {member.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-slate-900">
                  {member.name}
                </h1>
                <p className="truncate text-sm text-slate-500">
                  “{member.nickname}”
                </p>
              </div>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Group</dt>
                <dd className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                  {member.groupName}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Joined</dt>
                <dd className="font-medium text-slate-800">{joined}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Check-ins</dt>
                <dd className="font-semibold text-slate-900">
                  {attendance.length}
                </dd>
              </div>
            </dl>
          </section>

          <section className={`${cardCls} lg:col-span-2`}>
            <header className="border-b border-slate-100 px-5 py-4">
              <h2 className={pageTitleCls}>Attendance history</h2>
              <p className={pageSubtitleCls}>
                Every day {member.nickname} was marked present.
              </p>
            </header>

            {attendance.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                No check-ins recorded yet.
              </p>
            ) : (
              <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
                {attendance.map((entry) => (
                  <li
                    key={entry.date}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <span className="text-sm font-medium text-slate-800">
                      {formatDate(entry.date)}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs tabular-nums text-slate-500">
                        {entry.time}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        Present
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
