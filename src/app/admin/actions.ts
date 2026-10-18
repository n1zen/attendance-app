"use server";

import { refresh } from "next/cache";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { normalizeKey } from "@/lib/data";
import { getDb } from "@/lib/db";
import { clearAdminCookie } from "@/lib/session";
import type { MessageState } from "@/lib/types";

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
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
    await db.collection("groups").insertOne({
      name,
      nameKey: normalizeKey(name),
      createdAt: new Date(),
    });
    refresh();
    return { status: "success" };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
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
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!ObjectId.isValid(id)) {
    return { status: "error", message: "Invalid group." };
  }
  if (name.length < 2 || name.length > 50) {
    return { status: "error", message: "Group names must be 2–50 characters." };
  }

  try {
    const db = await getDb();
    const result = await db
      .collection("groups")
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: { name, nameKey: normalizeKey(name) } }
      );
    if (result.matchedCount === 0) {
      return { status: "error", message: "That group no longer exists." };
    }
    refresh();
    return { status: "success" };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
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
  const id = String(formData.get("id") ?? "");
  if (!ObjectId.isValid(id)) {
    return { status: "error", message: "Invalid group." };
  }

  const db = await getDb();
  const groupId = new ObjectId(id);
  const memberCount = await db
    .collection("users")
    .countDocuments({ groupId });
  if (memberCount > 0) {
    return {
      status: "error",
      message: `${memberCount} member${memberCount === 1 ? "" : "s"} still ${
        memberCount === 1 ? "uses" : "use"
      } this group. Move them to another group first.`,
    };
  }

  await db.collection("groups").deleteOne({ _id: groupId });
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
  if (!ObjectId.isValid(groupId)) {
    return { status: "error", message: "Pick a group from the list." };
  }

  try {
    const db = await getDb();
    const group = await db
      .collection("groups")
      .findOne({ _id: new ObjectId(groupId) });
    if (!group) {
      return { status: "error", message: "That group no longer exists." };
    }

    await db.collection("users").insertOne({
      name,
      nickname,
      nicknameKey: normalizeKey(nickname),
      groupId: group._id,
      createdAt: new Date(),
    });
    refresh();
    return { status: "success" };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
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
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const nickname = String(formData.get("nickname") ?? "").trim();
  const groupId = String(formData.get("groupId") ?? "").trim();

  if (!ObjectId.isValid(id)) {
    return { status: "error", message: "Invalid member." };
  }
  const fieldErrors = validateMemberFields(name, nickname, groupId);
  if (fieldErrors) {
    return { status: "error", message: Object.values(fieldErrors)[0] };
  }
  if (!ObjectId.isValid(groupId)) {
    return { status: "error", message: "Pick a group from the list." };
  }

  try {
    const db = await getDb();
    const group = await db
      .collection("groups")
      .findOne({ _id: new ObjectId(groupId) });
    if (!group) {
      return { status: "error", message: "That group no longer exists." };
    }

    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          name,
          nickname,
          nicknameKey: normalizeKey(nickname),
          groupId: group._id,
        },
      }
    );
    if (result.matchedCount === 0) {
      return { status: "error", message: "That member no longer exists." };
    }
    refresh();
    return { status: "success" };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
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
  const id = String(formData.get("id") ?? "");
  if (!ObjectId.isValid(id)) {
    return { status: "error", message: "Invalid member." };
  }

  const db = await getDb();
  const memberId = new ObjectId(id);
  await Promise.all([
    db.collection("users").deleteOne({ _id: memberId }),
    db.collection("attendance").deleteMany({ userId: memberId }),
  ]);
  refresh();
  return { status: "success" };
}
