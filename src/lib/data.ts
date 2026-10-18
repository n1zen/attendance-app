import { ObjectId } from "mongodb";
import { getDb } from "./db";
import type {
  AttendanceEntry,
  CheckInEntry,
  Group,
  GroupDoc,
  Member,
  UserDoc,
} from "./types";

/** Local calendar day as YYYY-MM-DD (matches the server's timezone). */
export function todayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local wall-clock time as HH:MM. */
export function timeLabel(date: Date = new Date()): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

export function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function serializeGroup(doc: GroupDoc): Group {
  return {
    id: doc._id.toString(),
    name: doc.name,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function getGroups(): Promise<Group[]> {
  const db = await getDb();
  const groups = await db
    .collection<GroupDoc>("groups")
    .find()
    .sort({ name: 1 })
    .toArray();
  return groups.map(serializeGroup);
}

export async function getGroupCounts(): Promise<
  Record<string, number>
> {
  const db = await getDb();
  const rows = await db
    .collection<UserDoc>("users")
    .aggregate<{ _id: ObjectId; count: number }>([
      { $group: { _id: "$groupId", count: { $sum: 1 } } },
    ])
    .toArray();
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row._id.toString()] = row.count;
  return counts;
}

export async function getMembers(): Promise<Member[]> {
  const db = await getDb();
  const [users, groups] = await Promise.all([
    db
      .collection<UserDoc>("users")
      .find()
      .sort({ nickname: 1 })
      .toArray(),
    getGroups(),
  ]);
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  return users.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    nickname: u.nickname,
    groupId: u.groupId.toString(),
    groupName: groupName.get(u.groupId.toString()) ?? "Ungrouped",
    createdAt: u.createdAt.toISOString(),
  }));
}

export async function getMember(
  id: string
): Promise<(Member & { createdDate: string }) | null> {
  if (!ObjectId.isValid(id)) return null;
  const db = await getDb();
  const user = await db
    .collection<UserDoc>("users")
    .findOne({ _id: new ObjectId(id) });
  if (!user) return null;
  const groups = await getGroups();
  const groupName =
    groups.find((g) => g.id === user.groupId.toString())?.name ??
    "Ungrouped";
  return {
    id: user._id.toString(),
    name: user.name,
    nickname: user.nickname,
    groupId: user.groupId.toString(),
    groupName,
    createdAt: user.createdAt.toISOString(),
    createdDate: todayKey(user.createdAt),
  };
}

export async function findMemberByNickname(
  nickname: string
): Promise<Member | null> {
  const db = await getDb();
  const user = await db.collection<UserDoc>("users").findOne({
    nicknameKey: normalizeKey(nickname),
  });
  if (!user) return null;
  return getMember(user._id.toString());
}

export type TodayStats = {
  present: number;
  total: number;
  groups: number;
  date: string;
};

export async function getTodayStats(): Promise<TodayStats> {
  const db = await getDb();
  const date = todayKey();
  const [present, total, groups] = await Promise.all([
    db.collection("attendance").countDocuments({ date }),
    db.collection("users").countDocuments(),
    db.collection("groups").countDocuments(),
  ]);
  return { present, total, groups, date };
}

export async function getTodayCheckIns(limit = 100): Promise<CheckInEntry[]> {
  const db = await getDb();
  const date = todayKey();

  // Post-lookup shape: `user` is unwound ($unwind, always one doc);
  // `group` uses preserveNullAndEmptyArrays, so it may be missing.
  type TodayRow = {
    _id: ObjectId;
    createdAt: Date;
    user: UserDoc;
    group?: GroupDoc;
  };

  const rows = await db
    .collection("attendance")
    .aggregate<TodayRow>([
      { $match: { date } },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: "groups",
          localField: "user.groupId",
          foreignField: "_id",
          as: "group",
        },
      },
      { $unwind: { path: "$group", preserveNullAndEmptyArrays: true } },
    ])
    .toArray();

  return rows
    .filter((row) => Boolean(row.user))
    .map((row) => ({
      id: row._id.toString(),
      name: row.user.name,
      nickname: row.user.nickname,
      groupName: row.group?.name ?? "Ungrouped",
      time: timeLabel(row.createdAt),
    }));
}

export async function getMemberAttendance(
  memberId: string,
  limit = 365
): Promise<AttendanceEntry[]> {
  if (!ObjectId.isValid(memberId)) return [];
  const db = await getDb();
  const rows = await db
    .collection("attendance")
    .find({ userId: new ObjectId(memberId) })
    .sort({ date: -1 })
    .limit(limit)
    .toArray();
  return rows.map((row) => ({ date: row.date, time: timeLabel(row.createdAt) }));
}

/**
 * Records today's attendance for a user. Upsert keeps it idempotent:
 * scanning twice on the same day never creates a second record.
 */
export async function markAttendance(
  userId: ObjectId
): Promise<{ status: "in" | "already"; time: string }> {
  const db = await getDb();
  const date = todayKey();
  const result = await db.collection("attendance").updateOne(
    { userId, date },
    { $setOnInsert: { userId, date, createdAt: new Date() } },
    { upsert: true }
  );
  if (result.upsertedCount > 0) {
    return { status: "in", time: timeLabel() };
  }
  const existing = await db
    .collection("attendance")
    .findOne({ userId, date });
  return { status: "already", time: existing ? timeLabel(existing.createdAt) : timeLabel() };
}
