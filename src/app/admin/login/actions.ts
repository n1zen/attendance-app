"use server";

import { redirect } from "next/navigation";
import {
  ensureAdminSeeded,
  verifyPassword,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { normalizeKey } from "@/lib/data";
import { setAdminCookie } from "@/lib/session";
import type { MessageState } from "@/lib/types";

export async function loginAction(
  _prev: MessageState,
  formData: FormData
): Promise<MessageState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { status: "error", message: "Enter your username and password." };
  }

  // First run: make sure an admin account exists before checking credentials.
  await ensureAdminSeeded();

  const db = await getDb();
  const admin = await db
    .collection("admins")
    .findOne({ usernameKey: normalizeKey(username) });

  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    return { status: "error", message: "Incorrect username or password." };
  }

  await setAdminCookie(admin._id.toString());
  redirect("/admin");
}
