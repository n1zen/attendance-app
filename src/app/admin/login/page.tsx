import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app-name";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Admin login",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {APP_NAME}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to manage members, groups, and check-ins.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
