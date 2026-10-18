import { connection } from "next/server";
import { getGroups, getMember, parseId } from "@/lib/data";
import { readDeviceToken } from "@/lib/session";
import { verifyToken } from "@/lib/tokens";
import { CheckInClient } from "./checkin-client";
import { NewUserPanel } from "./new-user-panel";

/**
 * Resolves who is scanning. The page is a blocking route (`instant = false`),
 * so this runs fully at request time (connection() + cookies() are
 * request-scoped APIs).
 */
export async function ScanContent() {
  await connection();

  const payload = verifyToken(await readDeviceToken());
  const userId = payload ? parseId(payload.id) : null;
  const member = userId === null ? null : await getMember(String(userId));

  if (!member) {
    const groups = await getGroups();
    return <NewUserPanel groups={groups} />;
  }

  return (
    <CheckInClient user={{ name: member.name, nickname: member.nickname }} />
  );
}
