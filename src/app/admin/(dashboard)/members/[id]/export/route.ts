import { requireAdmin } from "@/lib/auth";
import { APP_NAME } from "@/lib/app-name";
import {
  getMember,
  getMemberAttendance,
  timeLabel,
  todayKey,
} from "@/lib/data";
import { TIME_ZONE } from "@/lib/format";
import type { AttendanceEntry, Member } from "@/lib/types";

type MemberWithJoinDate = Member & { createdDate: string };

/**
 * Per-member file exports, linked from the member detail page:
 *
 *   /admin/members/[id]/export?format=csv
 *   /admin/members/[id]/export?format=xlsx
 *
 * Full attendance history (the member page has no date filter). The proxy
 * gates /admin/*; requireAdmin() re-verifies the session here too.
 */
export async function GET(
  request: Request,
  context: RouteContext<"/admin/members/[id]/export">
) {
  await requireAdmin();

  const { id } = await context.params;
  const member = await getMember(id);
  if (!member) return new Response("Member not found.", { status: 404 });

  // The detail page caps history at 365 rows for display; exports carry it all.
  const attendance = await getMemberAttendance(id, 100_000);

  const format = new URL(request.url).searchParams.get("format");
  if (format === "csv") return csvResponse(member, attendance);
  if (format === "xlsx") return xlsxResponse(member, attendance);
  return new Response('Unknown format — use ?format=csv or ?format=xlsx.', {
    status: 400,
  });
}

function fileBase(member: MemberWithJoinDate): string {
  const slug =
    member.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "member";
  return `attendance_${slug}_${todayKey()}`;
}

/* --------------------------------- CSV --------------------------------- */

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** One report file: member details, then every check-in (date, time). */
function csvResponse(
  member: MemberWithJoinDate,
  attendance: AttendanceEntry[]
): Response {
  const rows: (string | number)[][] = [
    ["Attendance report"],
    ["Member", member.name],
    ["Nickname", member.nickname],
    ["Group", member.groupName],
    ["Joined", member.createdDate],
    ["Check-ins", attendance.length],
    ["Times", `Philippine time (${TIME_ZONE})`],
    [],
    ["Date", "Time"],
    ...attendance.map((e) => [e.date, e.time]),
  ];

  const body = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  // BOM so Excel detects UTF-8 (accents in names survive).
  return new Response(`\uFEFF${body}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileBase(member)}.csv"`,
    },
  });
}

/* --------------------------------- XLSX -------------------------------- */

/** Detailed workbook: Summary + the full Attendance sheet. */
async function xlsxResponse(
  member: MemberWithJoinDate,
  attendance: AttendanceEntry[]
): Promise<Response> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME;
  wb.created = new Date();

  // History is newest-first, so [0] is the latest and .at(-1) the earliest.
  const summary = wb.addWorksheet("Summary");
  summary.addRow([`Attendance report — ${member.name}`]).font = { bold: true };
  summary.addRow([]);
  summary.addRow(["Nickname", member.nickname]);
  summary.addRow(["Group", member.groupName]);
  summary.addRow(["Joined", member.createdDate]);
  summary.addRow(["Check-ins", attendance.length]);
  summary.addRow(["First check-in", attendance.at(-1)?.date ?? ""]);
  summary.addRow(["Last check-in", attendance[0]?.date ?? ""]);
  summary.addRow([]);
  summary.addRow(["Generated", `${todayKey()} ${timeLabel()}`]);
  summary.getColumn(1).width = 16;
  summary.getColumn(2).width = 44;

  const sheet = wb.addWorksheet("Attendance");
  sheet.addRow(["Date", "Time"]).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getColumn(1).width = 14;
  sheet.getColumn(2).width = 12;
  for (const e of attendance) {
    sheet.addRow([e.date, e.time]);
  }

  const buffer = (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileBase(member)}.xlsx"`,
    },
  });
}
