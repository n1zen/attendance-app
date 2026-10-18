import type { Metadata } from "next";
import { connection } from "next/server";
import { getGroups, getMembers } from "@/lib/data";
import { pageSubtitleCls, pageTitleCls } from "@/lib/ui";
import { MembersClient } from "./members-client";

// This page renders fresh data from SQLite on every request, so it blocks
// instead of prerendering a static shell. See next.config.ts note.
export const instant = false;

export const metadata: Metadata = {
  title: "Members",
  robots: { index: false },
};

export default async function MembersPage() {
  await connection();
  const [members, groups] = await Promise.all([getMembers(), getGroups()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className={pageTitleCls}>Member management</h1>
        <p className={pageSubtitleCls}>
          Everyone who logs attendance — add manually, edit, or remove.
        </p>
      </div>

      <MembersClient members={members} groups={groups} />
    </div>
  );
}
