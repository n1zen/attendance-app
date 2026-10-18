"use server";

import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import {
  findMemberByNickname,
  markAttendance,
  normalizeKey,
} from "@/lib/data";
import {
  readDeviceToken,
  setDeviceCookie,
} from "@/lib/session";
import { verifyToken } from "@/lib/tokens";
import type { ClaimState, RegisterState, ScanResult } from "@/lib/types";

async function resolveDeviceUser() {
  const payload = verifyToken(await readDeviceToken());
  if (!payload || !ObjectId.isValid(payload.id)) return null;
  const db = await getDb();
  return db
    .collection("users")
    .findOne({ _id: new ObjectId(payload.id) });
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}

/** Called automatically when a recognized device opens /scan. Idempotent per day. */
export async function checkInAction(): Promise<ScanResult> {
  const user = await resolveDeviceUser();
  if (!user) return { status: "unauthorized" };
  try {
    return await markAttendance(user._id);
  } catch (err) {
    console.error("[scan] check-in failed:", err);
    return {
      status: "error",
      message: "Could not record your attendance. Please try again.",
    };
  }
}

/** First-time visitors: create the member, mark attendance, remember the device. */
export async function registerAction(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const name = String(formData.get("name") ?? "").trim();
  const nickname = String(formData.get("nickname") ?? "").trim();
  const groupId = String(formData.get("groupId") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) {
    fieldErrors.name = "Enter your full name (at least 2 characters).";
  } else if (name.length > 80) {
    fieldErrors.name = "Keep your name under 80 characters.";
  }
  if (nickname.length < 2) {
    fieldErrors.nickname = "Enter a nickname (at least 2 characters).";
  } else if (nickname.length > 40) {
    fieldErrors.nickname = "Keep your nickname under 40 characters.";
  }
  if (!groupId) {
    fieldErrors.groupId = "Choose your group.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors };
  }

  // A device that already has an account has nothing to register.
  const existing = await resolveDeviceUser();
  if (existing) return { status: "success" };

  try {
    const db = await getDb();

    if (!ObjectId.isValid(groupId)) {
      return {
        status: "error",
        fieldErrors: { groupId: "Pick a group from the list." },
      };
    }
    const group = await db
      .collection("groups")
      .findOne({ _id: new ObjectId(groupId) });
    if (!group) {
      return {
        status: "error",
        fieldErrors: {
          groupId: "That group no longer exists. Refresh and pick another.",
        },
      };
    }

    const result = await db.collection("users").insertOne({
      name,
      nickname,
      nicknameKey: normalizeKey(nickname),
      groupId: group._id,
      createdAt: new Date(),
    });

    await markAttendance(result.insertedId);
    await setDeviceCookie(result.insertedId.toString());
    return { status: "success" };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return {
        status: "error",
        message:
          "That nickname is already registered — use “I already have an account” below.",
      };
    }
    console.error("[scan] registration failed:", err);
    return {
      status: "error",
      message: "Could not register you right now. Please try again.",
    };
  }
}

/**
 * Two-step claim for existing members on a new device:
 * step 1 finds the member by nickname, step 2 confirms and sets the cookie.
 */
export async function claimAction(
  _prev: ClaimState,
  formData: FormData
): Promise<ClaimState> {
  const nickname = String(formData.get("nickname") ?? "").trim();
  const confirmId = String(formData.get("confirmId") ?? "").trim();

  if (!nickname) {
    return { status: "error", message: "Enter your nickname." };
  }

  const match = await findMemberByNickname(nickname);
  if (!match) {
    return {
      status: "error",
      message:
        "No member found with that nickname. Check the spelling or register as a new user.",
    };
  }

  if (!confirmId) {
    return {
      status: "found",
      match: {
        id: match.id,
        name: match.name,
        nickname: match.nickname,
        groupName: match.groupName,
      },
    };
  }

  // Confirmed: make sure the confirmed id still matches the nickname typed.
  if (match.id !== confirmId) {
    return {
      status: "error",
      message: "That member no longer exists. Search again.",
    };
  }

  try {
    await markAttendance(new ObjectId(match.id));
    await setDeviceCookie(match.id);
    return { status: "success" };
  } catch (err) {
    console.error("[scan] claim failed:", err);
    return {
      status: "error",
      message: "Could not check you in. Please try again.",
    };
  }
}
