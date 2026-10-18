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
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/n1zen/attendance-app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 fill-current"
                aria-hidden="true"
              >
                <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.4-1.5 3.4-1.2 3.4-1.2.6 1.6.2 2.8 0 3.2.9.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1 .9 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
              </svg>
              GitHub
            </a>
            <Link
              href="/admin"
              className="text-sm font-medium text-slate-600 transition hover:text-indigo-600"
            >
              Admin
            </Link>
          </div>
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
        Local-first · SQLite · Next.js · <a target="_blank" href="https://github.com/n1zen" className="hover:underline hover:text-indigo-600">n1zen-dev</a>
      </footer>
    </div>
  );
}
