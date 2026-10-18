/**
 * Philippine Time for every displayed date/time. Client-safe (no server
 * imports) so both Server and Client Components can use these helpers.
 */

export const TIME_ZONE = "Asia/Manila";

/**
 * Formats a `YYYY-MM-DD` day key (already stored in Philippine Time) as e.g.
 * "Sun, Oct 18, 2026". Parsed as UTC midnight and formatted in UTC so the
 * calendar date renders identically in every viewer's timezone.
 */
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Same, without the weekday — e.g. "Oct 18, 2026". */
export function formatDayShort(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Compact chart-axis label — e.g. "Oct 18". */
export function formatDayCompact(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * Formats a stored UTC ISO timestamp (members' created_at, attendance rows)
 * as a Philippine-Time calendar date — e.g. "Oct 18, 2026".
 */
export function formatIsoDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}
