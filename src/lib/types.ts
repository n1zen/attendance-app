/** Serialized shapes — safe to pass to Client Components. */
export type Group = {
  id: string;
  name: string;
  createdAt: string;
};

export type Member = {
  id: string;
  name: string;
  nickname: string;
  groupId: string;
  groupName: string;
  createdAt: string;
};

export type CheckInEntry = {
  id: string;
  name: string;
  nickname: string;
  groupName: string;
  time: string;
};

export type AttendanceEntry = {
  date: string;
  time: string;
};

/** Result of the scan-page check-in action. */
export type ScanResult =
  | { status: "in"; time: string }
  | { status: "already"; time: string }
  | { status: "unauthorized" }
  | { status: "error"; message: string };

/** Result of the new-user registration action. */
export type RegisterState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string> };

/** Result of the "I already have an account" claim action. */
export type ClaimState =
  | { status: "idle" }
  | { status: "found"; match: { id: string; name: string; nickname: string; groupName: string } }
  | { status: "success" }
  | { status: "error"; message?: string };

/** Generic outcome for admin forms (add / rename / delete / login). */
export type MessageState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message?: string };
