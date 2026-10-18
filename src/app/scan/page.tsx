import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app-name";
import { ScanContent } from "./scan-content";

export const metadata: Metadata = {
  title: "Scan",
  description: "Scan to log your attendance.",
};

// Blocking route: resolves the device cookie + SQLite on every request.
// (Streaming the panel behind a Suspense boundary risked leaving hard loads
// stuck on the loading card if the request died mid-stream.)
export const instant = false;

export default function ScanPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {APP_NAME}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          One scan and you&apos;re marked present.
        </p>
      </div>

      <ScanContent />
    </main>
  );
}
