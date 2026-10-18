"use client";

import { useActionState, useState } from "react";
import { changePasswordAction } from "@/app/admin/actions";
import type { MessageState } from "@/lib/types";
import {
  btnPrimary,
  errorText,
  inputCls,
  labelCls,
  successText,
} from "@/lib/ui";

const idle: MessageState = { status: "idle" };

export function PasswordForm() {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    idle
  );

  // Controlled inputs: React 19 resets uncontrolled forms after *any*
  // server action, so a validation error would otherwise wipe the fields.
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  // Clear the fields only on success (render-phase adjustment).
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") {
      setCurrent("");
      setNext("");
      setConfirm("");
    }
  }

  return (
    <form action={action} className="mt-4 space-y-4">
      <div>
        <label htmlFor="current-password" className={labelCls}>
          Current password
        </label>
        <input
          id="current-password"
          name="current"
          type="password"
          autoComplete="current-password"
          className={inputCls}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="new-password" className={labelCls}>
          New password
        </label>
        <input
          id="new-password"
          name="next"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className={inputCls}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
      </div>

      <div>
        <label htmlFor="confirm-password" className={labelCls}>
          Confirm new password
        </label>
        <input
          id="confirm-password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          className={inputCls}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {state.status === "error" && (
        <p className={errorText}>{state.message}</p>
      )}
      {state.status === "success" && state.message && (
        <p className={successText}>{state.message}</p>
      )}

      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
