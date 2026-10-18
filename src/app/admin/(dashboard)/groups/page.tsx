import type { Metadata } from "next";
import { connection } from "next/server";
import { getGroupCounts, getGroups } from "@/lib/data";
import { pageSubtitleCls, pageTitleCls } from "@/lib/ui";
import { GroupsClient } from "./groups-client";

// This page renders fresh data from SQLite on every request, so it blocks
// instead of prerendering a static shell. See next.config.ts note.
export const instant = false;

export const metadata: Metadata = {
  title: "Groups",
  robots: { index: false },
};

export default async function GroupsPage() {
  await connection();
  const [groups, counts] = await Promise.all([getGroups(), getGroupCounts()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className={pageTitleCls}>Group management</h1>
        <p className={pageSubtitleCls}>
          Add, rename, or remove groups — members pick one when they register.
        </p>
      </div>

      <GroupsClient groups={groups} counts={counts} />
    </div>
  );
}
