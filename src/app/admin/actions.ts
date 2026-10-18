"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { normalizeKey, parseId } from "@/lib/data";
import { getDb } from "@/lib/db";
import { clearAdminCookie } from "@/lib/session";
import type { MessageState } from "@/lib/types";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    String((err as { code: unknown }).code).startsWith("SQLITE_CONSTRAINT")
  );
}

export async function logoutAction(): Promise<void> {
  await clearAdminCookie();
  redirect("/admin/login");
}

/* ------------------------------ Groups ------------------------------ */

export async function addGroupAction(
  _prev: MessageState,
  formData: FormData
): Promise<MessageState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) {
    return { status: "error", message: "Enter a group name (2+ characters)." };
  }
  if (name.length > 50) {
    return { status: "error", message: "Keep group names under 50 characters." };
  }

  try {
    const db = await getDb();
    await db.execute({
      sql: "INSERT INTO groups (name, name_key, created_at) VALUES (?, ?, ?)",
      args: [name, normalizeKey(name), new Date().toISOString()],
    });
    refresh();
    return { status: "success" };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { status: "error", message: "A group with that name already exists." };
    }
    console.error("[admin] add group failed:", err);
    return { status: "error", message: "Could not create the group. Try again." };
  }
}

export async function renameGroupAction(
  _prev: MessageState,
  formData: FormData
): Promise<MessageState> {
  await requireAdmin();
  const id = parseId(String(formData.get("id") ?? ""));
  const name = String(formData.get("name") ?? "").trim();

  if (id === null) {
    return { status: "error", message: "Invalid group." };
  }
  if (name.length < 2 || name.length > 50) {
    return { status: "error", message: "Group names must be 2–50 characters." };
  }

  try {
    const db = await getDb();
    const result = await db.execute({
      sql: "UPDATE groups SET name = ?, name_key = ? WHERE id = ?",
      args: [name, normalizeKey(name), id],
    });
    if (result.rowsAffected === 0) {
      return { status: "error", message: "That group no longer exists." };
    }
    refresh();
    return { status: "success" };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { status: "error", message: "A group with that name already exists." };
    }
    console.error("[admin] rename group failed:", err);
    return { status: "error", message: "Could not rename the group. Try again." };
  }
}

export async function deleteGroupAction(
  _prev: MessageState,
  formData: FormData
): Promise<MessageState> {
  await requireAdmin();
  const id = parseId(String(formData.get("id") ?? ""));
  if (id === null) {
    return { status: "error", message: "Invalid group." };
  }

  const db = await getDb();
  const countResult = await db.execute({
    sql: "SELECT COUNT(*) AS count FROM users WHERE group_id = ?",
    args: [id],
  });
  const memberCount = Number(countResult.rows[0]?.count ?? 0);
  if (memberCount > 0) {
    return {
      status: "error",
      message: `${memberCount} member${memberCount === 1 ? "" : "s"} still ${
        memberCount === 1 ? "uses" : "use"
      } this group. Move them to another group first.`,
    };
  }

  await db.execute({ sql: "DELETE FROM groups WHERE id = ?", args: [id] });
  refresh();
  return { status: "success" };
}

/* ------------------------------ Members ----------------------------- */

function validateMemberFields(
  name: string,
  nickname: string,
  groupId: string
): Record<string, string> | null {
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Enter a full name (2+ characters).";
  else if (name.length > 80) fieldErrors.name = "Keep names under 80 characters.";
  if (nickname.length < 2) {
    fieldErrors.nickname = "Enter a nickname (2+ characters).";
  } else if (nickname.length > 40) {
    fieldErrors.nickname = "Keep nicknames under 40 characters.";
  }
  if (!groupId) fieldErrors.groupId = "Choose a group.";
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}

export async function addMemberAction(
  _prev: MessageState,
  formData: FormData
): Promise<MessageState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const nickname = String(formData.get("nickname") ?? "").trim();
  const groupId = String(formData.get("groupId") ?? "").trim();

  const fieldErrors = validateMemberFields(name, nickname, groupId);
  if (fieldErrors) {
    return {
      status: "error",
      message: Object.values(fieldErrors)[0],
    };
  }
  const numericGroupId = parseId(groupId);
  if (numericGroupId === null) {
    return { status: "error", message: "Pick a group from the list." };
  }

  try {
    const db = await getDb();
    const group = await db.execute({
      sql: "SELECT id FROM groups WHERE id = ?",
      args: [numericGroupId],
    });
    if (group.rows.length === 0) {
      return { status: "error", message: "That group no longer exists." };
    }

    await db.execute({
      sql: `INSERT INTO users (name, nickname, nickname_key, group_id, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [name, nickname, normalizeKey(nickname), numericGroupId, new Date().toISOString()],
    });
    refresh();
    return { status: "success" };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        status: "error",
        message: "That nickname is already taken by another member.",
      };
    }
    console.error("[admin] add member failed:", err);
    return { status: "error", message: "Could not add the member. Try again." };
  }
}

export async function updateMemberAction(
  _prev: MessageState,
  formData: FormData
): Promise<MessageState> {
  await requireAdmin();
  const id = parseId(String(formData.get("id") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const nickname = String(formData.get("nickname") ?? "").trim();
  const groupId = String(formData.get("groupId") ?? "").trim();

  if (id === null) {
    return { status: "error", message: "Invalid member." };
  }
  const fieldErrors = validateMemberFields(name, nickname, groupId);
  if (fieldErrors) {
    return { status: "error", message: Object.values(fieldErrors)[0] };
  }
  const numericGroupId = parseId(groupId);
  if (numericGroupId === null) {
    return { status: "error", message: "Pick a group from the list." };
  }

  try {
    const db = await getDb();
    const group = await db.execute({
      sql: "SELECT id FROM groups WHERE id = ?",
      args: [numericGroupId],
    });
    if (group.rows.length === 0) {
      return { status: "error", message: "That group no longer exists." };
    }

    const result = await db.execute({
      sql: `UPDATE users
            SET name = ?, nickname = ?, nickname_key = ?, group_id = ?
            WHERE id = ?`,
      args: [name, nickname, normalizeKey(nickname), numericGroupId, id],
    });
    if (result.rowsAffected === 0) {
      return { status: "error", message: "That member no longer exists." };
    }
    refresh();
    return { status: "success" };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        status: "error",
        message: "That nickname is already taken by another member.",
      };
    }
    console.error("[admin] update member failed:", err);
    return { status: "error", message: "Could not update the member. Try again." };
  }
}

export async function deleteMemberAction(
  _prev: MessageState,
  formData: FormData
): Promise<MessageState> {
  await requireAdmin();
  const id = parseId(String(formData.get("id") ?? ""));
  if (id === null) {
    return { status: "error", message: "Invalid member." };
  }

  const db = await getDb();
  // Attendance first so the delete works regardless of foreign-key mode.
  await db.batch(
    [
      { sql: "DELETE FROM attendance WHERE user_id = ?", args: [id] },
      { sql: "DELETE FROM users WHERE id = ?", args: [id] },
    ],
    "write"
  );
  refresh();
  return { status: "success" };
}
