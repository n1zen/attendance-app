"use client";

import { useActionState, useState } from "react";
import type { MessageState } from "@/lib/types";
import { btnPrimary, errorText, inputCls, labelCls } from "@/lib/ui";
import { loginAction } from "./actions";

const initialState: MessageState = { status: "idle" };

export function LoginForm() {
  const [state, action, pending] = useActionState(
    loginAction,
    initialState
  );

  // Controlled inputs: React 19 resets uncontrolled forms after *any* server
  // action, so a failed sign-in would otherwise wipe the typed credentials.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="username" className={labelCls}>
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className={inputCls}
          placeholder="admin"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="password" className={labelCls}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className={inputCls}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {state.status === "error" && (
        <p className={errorText}>{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`${btnPrimary} w-full`}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
