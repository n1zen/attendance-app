"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { ScanResult } from "@/lib/types";
import { btnPrimary, btnSecondary, cardCls, errorText } from "@/lib/ui";
import { checkInAction } from "./actions";

/**
 * Shown to recognized devices. On mount it checks the user in with zero
 * interaction — scanning really is the only step. The form-style button
 * doubles as a manual retry.
 */
export function CheckInClient({
  user,
}: {
  user: { name: string; nickname: string };
}) {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const startedRef = useRef(false);

  const run = useCallback(() => {
    startTransition(async () => {
      try {
        setResult(await checkInAction());
      } catch {
        setResult({
          status: "error",
          message: "Something went wrong. Please try again.",
        });
      }
    });
  }, [startTransition]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    run();
  }, [run]);

  if (result === null) {
    return (
      <div className={`${cardCls} flex flex-col items-center gap-4 p-8 text-center`}>
        <div
          aria-hidden
          className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"
        />
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Welcome back, {user.nickname}
          </h2>
          <p className="mt-1 text-sm text-slate-500">Checking you in…</p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={isPending}
          className={btnPrimary}
        >
          {isPending ? "Checking in…" : "Check in now"}
        </button>
      </div>
    );
  }

  if (result.status === "in" || result.status === "already") {
    return (
      <div className={`${cardCls} flex flex-col items-center gap-3 p-8 text-center`}>
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl">
          ✅
        </span>
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            You&apos;re marked present
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {result.status === "in"
              ? `Checked in at ${result.time}`
              : `Already checked in today at ${result.time}`}
          </p>
        </div>
        <p className="text-sm font-medium text-slate-600">{user.name}</p>
        <p className="text-xs text-slate-400">See you next time 👋</p>
      </div>
    );
  }

  if (result.status === "unauthorized") {
    return (
      <div className={`${cardCls} flex flex-col items-center gap-4 p-8 text-center`}>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            We couldn&apos;t identify this device
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Let&apos;s get you set up — it only happens once.
          </p>
        </div>
        <a href="/scan" className={btnSecondary}>
          Identify this device
        </a>
      </div>
    );
  }

  return (
    <div className={`${cardCls} flex flex-col items-center gap-4 p-8 text-center`}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Something went wrong
        </h2>
        <p className={`mt-1 ${errorText}`}>{result.message}</p>
      </div>
      <button type="button" onClick={run} disabled={isPending} className={btnPrimary}>
        {isPending ? "Trying…" : "Try again"}
      </button>
    </div>
  );
}
