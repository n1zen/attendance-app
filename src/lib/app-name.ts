/**
 * The application's display name — set it with the `APP_NAME` environment
 * variable (falls back to "AttendanceApp"). Read server-side only: page
 * headers, document titles, and export metadata all use it. Like most env
 * vars, a change takes effect after a rebuild.
 */
export const APP_NAME = process.env.APP_NAME?.trim() || "AttendanceApp";
