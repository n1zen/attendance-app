import { ObjectId } from "mongodb";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { getGroups } from "@/lib/data";
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
  let user: { name: string; nickname: string } | null = null;

  if (payload && ObjectId.isValid(payload.id)) {
    const db = await getDb();
    const doc = await db
      .collection("users")
      .findOne({ _id: new ObjectId(payload.id) });
    if (doc) user = { name: doc.name, nickname: doc.nickname };
  }

  if (!user) {
    const groups = await getGroups();
    return <NewUserPanel groups={groups} />;
  }

  return <CheckInClient user={user} />;
}
