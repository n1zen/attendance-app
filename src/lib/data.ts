import type { Row } from "@libsql/client";
import { getDb } from "./db";
import { TIME_ZONE } from "./format";
import type {
  AttendanceEntry,
  CheckInEntry,
  Group,
  Member,
} from "./types";

/*
 * All day/time keys are computed in Philippine Time — the app's timezone —
 * regardless of where the server runs (Vercel hosts are UTC).
 */
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** Philippine calendar day as YYYY-MM-DD. */
export function todayKey(date: Date = new Date()): string {
  return dayFormatter.format(date);
}

/** Philippine wall-clock time, 12-hour — e.g. "4:25 PM". */
export function timeLabel(date: Date = new Date()): string {
  return timeFormatter.format(date);
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

/* ----------------------------- Analytics ----------------------------- */

/** Returns the value as a real YYYY-MM-DD calendar day, or null. */
function parseDay(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  // Round-trip catches impossible days like 2026-02-31.
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function daysAgo(count: number): string {
  const d = new Date();
  d.setDate(d.getDate() - count);
  return todayKey(d);
}

/**
 * Resolves user-supplied `from`/`to` query params into a valid range.
 * Falls back to the last 7 days (ending today) for missing/invalid values,
 * and swaps the bounds when reversed. Days are Philippine-Time keys.
 */
export function resolveRange(
  from: string | undefined,
  to: string | undefined
): { from: string; to: string } {
  let f = parseDay(from) ?? daysAgo(6);
  let t = parseDay(to) ?? todayKey();
  if (f > t) [f, t] = [t, f];
  return { from: f, to: t };
}

export type DayCount = { date: string; count: number };

export type GroupAnalytics = {
  id: string;
  name: string;
  members: number;
  active: number;
  checkins: number;
};

export type MemberAnalytics = {
  id: string;
  name: string;
  nickname: string;
  groupName: string;
  checkins: number;
  lastDate: string | null;
};

export type RangeStats = {
  from: string;
  to: string;
  days: number;
  totalCheckins: number;
  activeMembers: number;
  activeGroups: number;
  daily: DayCount[];
  groups: GroupAnalytics[];
  members: MemberAnalytics[];
};

function daySpan(from: string, to: string): number {
  const ms =
    new Date(`${to}T00:00:00Z`).getTime() -
    new Date(`${from}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * Attendance analytics for a date range (Philippine day keys): per-day
 * totals, per-group breakdown, and per-member breakdown. Check-ins are
 * attributed to each member's current group.
 */
export async function getRangeStats(
  from: string,
  to: string
): Promise<RangeStats> {
  const db = await getDb();
  const args = [from, to];

  const [daily, groups, members] = await Promise.all([
    db.execute({
      sql: `SELECT date, COUNT(*) AS count FROM attendance
            WHERE date BETWEEN ? AND ?
            GROUP BY date
            ORDER BY date`,
      args,
    }),
    db.execute({
      sql: `SELECT g.id, g.name,
                   COUNT(DISTINCT u.id) AS members,
                   COUNT(DISTINCT a.user_id) AS active,
                   COUNT(a.id) AS checkins
            FROM groups g
            LEFT JOIN users u ON u.group_id = g.id
            LEFT JOIN attendance a
              ON a.user_id = u.id AND a.date BETWEEN ? AND ?
            GROUP BY g.id
            ORDER BY checkins DESC, g.name`,
      args,
    }),
    db.execute({
      sql: `SELECT u.id, u.name, u.nickname,
                   COALESCE(g.name, 'Ungrouped') AS group_name,
                   COUNT(a.id) AS checkins,
                   MAX(a.date) AS last_date
            FROM users u
            LEFT JOIN groups g ON g.id = u.group_id
            LEFT JOIN attendance a
              ON a.user_id = u.id AND a.date BETWEEN ? AND ?
            GROUP BY u.id
            ORDER BY checkins DESC, u.nickname`,
      args,
    }),
  ]);

  const groupRows = groups.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    members: Number(r.members),
    active: Number(r.active),
    checkins: Number(r.checkins),
  }));

  return {
    from,
    to,
    days: daySpan(from, to),
    totalCheckins: groupRows.reduce((sum, g) => sum + g.checkins, 0),
    activeMembers: groupRows.reduce((sum, g) => sum + g.active, 0),
    activeGroups: groupRows.filter((g) => g.active > 0).length,
    daily: daily.rows.map((r) => ({
      date: String(r.date),
      count: Number(r.count),
    })),
    groups: groupRows,
    members: members.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      nickname: String(r.nickname),
      groupName: String(r.group_name),
      checkins: Number(r.checkins),
      lastDate: r.last_date ? String(r.last_date) : null,
    })),
  };
}

/** Fills the missing days of a range with zero counts. */
export function zeroFill(
  from: string,
  to: string,
  days: DayCount[]
): DayCount[] {
  const byDate = new Map(days.map((d) => [d.date, d.count]));
  const out: DayCount[] = [];
  const cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur.getTime() <= end.getTime()) {
    const key = cur.toISOString().slice(0, 10);
    out.push({ date: key, count: byDate.get(key) ?? 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export type AttendanceLogEntry = {
  date: string;
  time: string;
  name: string;
  nickname: string;
  groupName: string;
};

/**
 * Every check-in row in a range, in order — the raw feed for the CSV/XLSX
 * exports. `time` is the Philippine-Time wall clock of the check-in.
 */
export async function getAttendanceLog(
  from: string,
  to: string
): Promise<AttendanceLogEntry[]> {
  const db = await getDb();
  const rs = await db.execute({
    sql: `SELECT a.date, a.created_at, u.name, u.nickname,
                 COALESCE(g.name, 'Ungrouped') AS group_name
          FROM attendance a
          JOIN users u ON u.id = a.user_id
          LEFT JOIN groups g ON g.id = u.group_id
          WHERE a.date BETWEEN ? AND ?
          ORDER BY a.date, a.created_at`,
    args: [from, to],
  });
  return rs.rows.map((r) => ({
    date: String(r.date),
    time: timeLabel(new Date(String(r.created_at))),
    name: String(r.name),
    nickname: String(r.nickname),
    groupName: String(r.group_name),
  }));
}
