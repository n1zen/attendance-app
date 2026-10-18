import Link from "next/link";
import { APP_NAME } from "@/lib/app-name";
import { btnPrimary, btnSecondary, cardCls } from "@/lib/ui";

const steps = [
  {
    title: "Scan the QR code",
    body: "The admin dashboard shows one QR code. Point your camera at it.",
  },
  {
    title: "First time? Register once",
    body: "Enter your name, nickname, and group. Only takes a few seconds.",
  },
  {
    title: "That's it — you're in",
    body: "Every scan after that marks you present for the day automatically.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <span className="text-sm font-bold tracking-tight text-slate-900">
            {APP_NAME}
          </span>
          <Link
            href="/admin"
            className="text-sm font-medium text-slate-600 transition hover:text-indigo-600"
          >
            Admin
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-14 text-center">
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-600">
          Scan · Mark · Go
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Attendance in a single scan.
        </h1>
        <p className="mt-4 max-w-xl text-base text-slate-600">
          Point your camera at the QR code — register once the first time,
          then scanning is all it takes to log your attendance.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/scan" className={btnPrimary}>
            Open the scan page
          </Link>
          <Link href="/admin" className={btnSecondary}>
            Admin dashboard
          </Link>
        </div>

        <ol className="mt-14 grid w-full gap-4 text-left sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className={`${cardCls} p-5`}>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              <h2 className="mt-3 text-sm font-semibold text-slate-900">
                {step.title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        Local-first · SQLite · Next.js · <a href="https://github.com/n1zen" className="hover:underline hover:text-indigo-600">n1zen-dev</a>
      </footer>
    </div>
  );
}
