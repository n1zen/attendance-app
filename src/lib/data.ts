import type { Row } from "@libsql/client";
import { getDb } from "./db";
import type {
  AttendanceEntry,
  CheckInEntry,
  Group,
  Member,
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

/**
 * Parses a string id (form field, URL param, token payload) into a SQLite
 * row id. Returns null for anything that isn't a positive integer.
 */
export function parseId(value: string | null | undefined): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

type MemberRow = {
  id: number;
  name: string;
  nickname: string;
  group_id: number;
  created_at: string;
  group_name: string;
};

/** libSQL rows are dynamically typed; narrow one to a known column shape. */
function castRow<T>(row: Row): T {
  return row as unknown as T;
}

const MEMBER_SELECT = `
  SELECT u.id, u.name, u.nickname, u.group_id, u.created_at,
         COALESCE(g.name, 'Ungrouped') AS group_name
  FROM users u
  LEFT JOIN groups g ON g.id = u.group_id
`;

function serializeMember(row: MemberRow): Member {
  return {
    id: String(row.id),
    name: row.name,
    nickname: row.nickname,
    groupId: String(row.group_id),
    groupName: row.group_name,
    createdAt: row.created_at,
  };
}

export async function getGroups(): Promise<Group[]> {
  const db = await getDb();
  const rs = await db.execute(
    "SELECT id, name, created_at FROM groups ORDER BY name"
  );
  return rs.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    createdAt: String(row.created_at),
  }));
}

export async function getGroupCounts(): Promise<
  Record<string, number>
> {
  const db = await getDb();
  const rs = await db.execute(
    "SELECT group_id, COUNT(*) AS count FROM users GROUP BY group_id"
  );
  const counts: Record<string, number> = {};
  for (const row of rs.rows) {
    counts[String(row.group_id)] = Number(row.count);
  }
  return counts;
}

export async function getMembers(): Promise<Member[]> {
  const db = await getDb();
  const rs = await db.execute(`${MEMBER_SELECT} ORDER BY u.nickname`);
  return rs.rows.map((row) => serializeMember(castRow<MemberRow>(row)));
}

export async function getMember(
  id: string
): Promise<(Member & { createdDate: string }) | null> {
  const numericId = parseId(id);
  if (numericId === null) return null;
  const db = await getDb();
  const rs = await db.execute({
    sql: `${MEMBER_SELECT} WHERE u.id = ?`,
    args: [numericId],
  });
  const row = rs.rows[0];
  if (!row) return null;
  return {
    ...serializeMember(castRow<MemberRow>(row)),
    createdDate: todayKey(new Date(String(row.created_at))),
  };
}

export async function findMemberByNickname(
  nickname: string
): Promise<Member | null> {
  const db = await getDb();
  const rs = await db.execute({
    sql: `${MEMBER_SELECT} WHERE u.nickname_key = ?`,
    args: [normalizeKey(nickname)],
  });
  const row = rs.rows[0];
  return row ? serializeMember(castRow<MemberRow>(row)) : null;
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
  const rs = await db.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM attendance WHERE date = ?) AS present,
            (SELECT COUNT(*) FROM users) AS total,
            (SELECT COUNT(*) FROM groups) AS groups`,
    args: [date],
  });
  const row = rs.rows[0];
  return {
    present: Number(row?.present ?? 0),
    total: Number(row?.total ?? 0),
    groups: Number(row?.groups ?? 0),
    date,
  };
}

export async function getTodayCheckIns(limit = 100): Promise<CheckInEntry[]> {
  const db = await getDb();
  const rs = await db.execute({
    sql: `SELECT a.id, a.created_at, u.name, u.nickname,
                 COALESCE(g.name, 'Ungrouped') AS group_name
          FROM attendance a
          JOIN users u ON u.id = a.user_id
          LEFT JOIN groups g ON g.id = u.group_id
          WHERE a.date = ?
          ORDER BY a.created_at DESC
          LIMIT ?`,
    args: [todayKey(), limit],
  });
  return rs.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    nickname: String(row.nickname),
    groupName: String(row.group_name),
    time: timeLabel(new Date(String(row.created_at))),
  }));
}

export async function getMemberAttendance(
  memberId: string,
  limit = 365
): Promise<AttendanceEntry[]> {
  const numericId = parseId(memberId);
  if (numericId === null) return [];
  const db = await getDb();
  const rs = await db.execute({
    sql: `SELECT date, created_at FROM attendance
          WHERE user_id = ?
          ORDER BY date DESC
          LIMIT ?`,
    args: [numericId, limit],
  });
  return rs.rows.map((row) => ({
    date: String(row.date),
    time: timeLabel(new Date(String(row.created_at))),
  }));
}

/**
 * Records today's attendance for a user. The `(user_id, date)` unique index
 * plus `ON CONFLICT DO NOTHING` keeps it idempotent: scanning twice on the
 * same day never creates a second record.
 */
export async function markAttendance(
  userId: number
): Promise<{ status: "in" | "already"; time: string }> {
  const db = await getDb();
  const date = todayKey();
  const inserted = await db.execute({
    sql: `INSERT INTO attendance (user_id, date, created_at)
          VALUES (?, ?, ?)
          ON CONFLICT (user_id, date) DO NOTHING`,
    args: [userId, date, new Date().toISOString()],
  });
  if (inserted.rowsAffected > 0) {
    return { status: "in", time: timeLabel() };
  }
  const existing = await db.execute({
    sql: "SELECT created_at FROM attendance WHERE user_id = ? AND date = ?",
    args: [userId, date],
  });
  const createdAt = existing.rows[0]?.created_at;
  return {
    status: "already",
    time: createdAt ? timeLabel(new Date(String(createdAt))) : timeLabel(),
  };
}
