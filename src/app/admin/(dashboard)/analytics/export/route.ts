import { requireAdmin } from "@/lib/auth";
import { APP_NAME } from "@/lib/app-name";
import {
  getAttendanceLog,
  getRangeStats,
  resolveRange,
  timeLabel,
  todayKey,
  zeroFill,
  type RangeStats,
} from "@/lib/data";
import { TIME_ZONE } from "@/lib/format";

/**
 * Analytics file exports, linked from the analytics page:
 *
 *   /admin/analytics/export?format=csv&from=YYYY-MM-DD&to=YYYY-MM-DD
 *   /admin/analytics/export?format=xlsx&from=...&to=...
 *
 * `from`/`to` are resolved exactly like the page (invalid → last 7 days).
 * The proxy gates /admin/*; requireAdmin() re-verifies the session here too.
 */
export async function GET(request: Request) {
  await requireAdmin();

  const params = new URL(request.url).searchParams;
  const range = resolveRange(
    params.get("from") ?? undefined,
    params.get("to") ?? undefined
  );
  const stats = await getRangeStats(range.from, range.to);

  const format = params.get("format");
  if (format === "csv") return csvResponse(stats);
  if (format === "xlsx") return xlsxResponse(stats);
  return new Response('Unknown format — use ?format=csv or ?format=xlsx.', {
    status: 400,
  });
}

function fileBase(stats: RangeStats): string {
  return `attendance-analytics_${stats.from}_${stats.to}`;
}

/* --------------------------------- CSV --------------------------------- */

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** One report file: summary, per-day, per-group, and per-member sections. */
function csvResponse(stats: RangeStats): Response {
  const rows: (string | number)[][] = [
    ["Attendance analytics"],
    ["Range", `${stats.from} to ${stats.to}`, `Philippine time (${TIME_ZONE})`],
    [],
    ["Summary"],
    ["Total check-ins", stats.totalCheckins],
    ["Active members", stats.activeMembers],
    ["Active groups", stats.activeGroups],
    ["Days in range", stats.days],
    [],
    ["Check-ins per day"],
    ["Date", "Check-ins"],
    ...zeroFill(stats.from, stats.to, stats.daily).map((d) => [
      d.date,
      d.count,
    ]),
    [],
    ["By group"],
    ["Group", "Members", "Active members", "Check-ins"],
    ...stats.groups.map((g) => [g.name, g.members, g.active, g.checkins]),
    [],
    ["By member"],
    ["Member", "Nickname", "Group", "Last check-in", "Check-ins"],
    ...stats.members.map((m) => [
      m.name,
      m.nickname,
      m.groupName,
      m.lastDate ?? "",
      m.checkins,
    ]),
  ];

  const body = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  // BOM so Excel detects UTF-8 (accents in names survive).
  return new Response(`\uFEFF${body}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileBase(stats)}.csv"`,
    },
  });
}

/* --------------------------------- XLSX -------------------------------- */

/** Detailed workbook: Summary / Daily / By Group / By Member / Check-ins. */
async function xlsxResponse(stats: RangeStats): Promise<Response> {
  const log = await getAttendanceLog(stats.from, stats.to);
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME;
  wb.created = new Date();

  const sheet = (name: string, headers: string[], widths: number[]) => {
    const ws = wb.addWorksheet(name);
    ws.addRow(headers).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    widths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });
    return ws;
  };

  const summary = wb.addWorksheet("Summary");
  summary.addRow(["Attendance analytics"]).font = { bold: true };
  summary.addRow([`Range: ${stats.from} to ${stats.to} (Philippine time)`]);
  summary.addRow([]);
  summary.addRow(["Total check-ins", stats.totalCheckins]);
  summary.addRow(["Active members", stats.activeMembers]);
  summary.addRow(["Active groups", stats.activeGroups]);
  summary.addRow(["Days in range", stats.days]);
  summary.addRow([]);
  summary.addRow(["Generated", `${todayKey()} ${timeLabel()}`]);
  summary.getColumn(1).width = 18;
  summary.getColumn(2).width = 44;

  const daily = sheet("Daily", ["Date", "Check-ins"], [14, 12]);
  for (const d of zeroFill(stats.from, stats.to, stats.daily)) {
    daily.addRow([d.date, d.count]);
  }

  const groups = sheet(
    "By Group",
    ["Group", "Members", "Active members", "Check-ins"],
    [24, 10, 14, 12]
  );
  for (const g of stats.groups) {
    groups.addRow([g.name, g.members, g.active, g.checkins]);
  }

  const members = sheet(
    "By Member",
    ["Member", "Nickname", "Group", "Last check-in", "Check-ins"],
    [24, 16, 20, 14, 12]
  );
  for (const m of stats.members) {
    members.addRow([m.name, m.nickname, m.groupName, m.lastDate ?? "", m.checkins]);
  }

  const checkins = sheet(
    "Check-ins",
    ["Date", "Time", "Member", "Nickname", "Group"],
    [14, 11, 24, 16, 20]
  );
  for (const e of log) {
    checkins.addRow([e.date, e.time, e.name, e.nickname, e.groupName]);
  }

  const buffer = (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileBase(stats)}.xlsx"`,
    },
  });
}
