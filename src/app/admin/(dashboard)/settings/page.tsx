import type { Metadata } from "next";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  cardCls,
  mutedText,
  pageSubtitleCls,
  pageTitleCls,
} from "@/lib/ui";
import { PasswordForm } from "./password-form";

// This page reads the admin session, so it blocks instead of prerendering.
// See next.config.ts note.
export const instant = false;

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false },
};

export default async function SettingsPage() {
  await connection();
  const admin = await requireAdmin();

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className={pageTitleCls}>Settings</h1>
        <p className={pageSubtitleCls}>
          Signed in as <span className="font-medium">{admin.username}</span>.
        </p>
      </div>

      <section className={`${cardCls} p-5`}>
        <h2 className="text-base font-semibold text-slate-900">
          Change password
        </h2>
        <p className={`mt-1 ${mutedText}`}>
          You stay signed in after changing it. Everyone signed out elsewhere
          will need the new password.
        </p>
        <PasswordForm />
      </section>
    </div>
  );
}
