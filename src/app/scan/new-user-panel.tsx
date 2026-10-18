"use client";

import { useActionState, useState } from "react";
import type { ClaimState, Group, RegisterState } from "@/lib/types";
import {
  btnPrimary,
  btnSecondary,
  cardCls,
  errorText,
  inputCls,
  labelCls,
} from "@/lib/ui";
import { claimAction, registerAction } from "./actions";

const initialRegister: RegisterState = { status: "idle" };
const initialClaim: ClaimState = { status: "idle" };

/** Shown to first-time (or unrecognized) devices. */
export function NewUserPanel({ groups }: { groups: Group[] }) {
  const [tab, setTab] = useState<"register" | "claim">("register");

  return (
    <div className={`${cardCls} p-6`}>
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        <TabButton
          active={tab === "register"}
          onClick={() => setTab("register")}
        >
          I&apos;m new here
        </TabButton>
        <TabButton
          active={tab === "claim"}
          onClick={() => setTab("claim")}
        >
          I already have an account
        </TabButton>
      </div>

      {tab === "register" ? (
        <RegisterSection groups={groups} />
      ) : (
        <ClaimSection />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function RegisterSection({ groups }: { groups: Group[] }) {
  const [state, action, pending] = useActionState(
    registerAction,
    initialRegister
  );

  // Controlled inputs: React 19 resets uncontrolled forms after *any* server
  // action — a duplicate-nickname error would otherwise erase the whole form.
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [groupId, setGroupId] = useState("");

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div
          aria-hidden
          className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"
        />
        <p className="text-sm font-medium text-slate-600">
          All set — checking you in…
        </p>
      </div>
    );
  }

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const message = state.status === "error" ? state.message : undefined;

  if (groups.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm font-medium text-slate-700">No groups yet</p>
        <p className="mt-1 text-sm text-slate-500">
          Ask an admin to create groups first — you&apos;ll pick yours during
          registration.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-slate-500">
        Tell us who you are — this only happens once.
      </p>

      <div>
        <label htmlFor="name" className={labelCls}>
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={80}
          placeholder="Jane Doe"
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {fieldErrors?.name && (
          <p className={`mt-1 ${errorText}`}>{fieldErrors.name}</p>
        )}
      </div>

      <div>
        <label htmlFor="nickname" className={labelCls}>
          Nickname
        </label>
        <input
          id="nickname"
          name="nickname"
          type="text"
          maxLength={40}
          placeholder="What people call you"
          className={inputCls}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        {fieldErrors?.nickname && (
          <p className={`mt-1 ${errorText}`}>{fieldErrors.nickname}</p>
        )}
      </div>

      <div>
        <label htmlFor="groupId" className={labelCls}>
          Group
        </label>
        <select
          id="groupId"
          name="groupId"
          className={inputCls}
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        >
          <option value="" disabled>
            Select your group…
          </option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        {fieldErrors?.groupId && (
          <p className={`mt-1 ${errorText}`}>{fieldErrors.groupId}</p>
        )}
      </div>

      {message && <p className={errorText}>{message}</p>}

      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
        {pending ? "Registering…" : "Register & check in"}
      </button>
    </form>
  );
}

function ClaimSection() {
  // Remounting with a new key resets the action state ("Search again").
  const [attempt, setAttempt] = useState(0);
  return <ClaimForm key={attempt} onReset={() => setAttempt((a) => a + 1)} />;
}

function ClaimForm({ onReset }: { onReset: () => void }) {
  const [state, action, pending] = useActionState(claimAction, initialClaim);
  const message = state.status === "error" ? state.message : undefined;

  // Controlled so a "no match" error keeps the nickname that was typed.
  const [nickname, setNickname] = useState("");

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div
          aria-hidden
          className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"
        />
        <p className="text-sm font-medium text-slate-600">
          You&apos;re all set — checking you in…
        </p>
      </div>
    );
  }

  if (state.status === "found") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-slate-500">Is this you?</p>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-base font-semibold text-slate-900">
            {state.match.name}
          </p>
          <p className="text-sm text-slate-600">
            “{state.match.nickname}” · {state.match.groupName}
          </p>
        </div>

        <form action={action} className="space-y-3">
          <input type="hidden" name="nickname" value={state.match.nickname} />
          <input type="hidden" name="confirmId" value={state.match.id} />
          <button
            type="submit"
            disabled={pending}
            className={`${btnPrimary} w-full`}
          >
            {pending ? "Checking you in…" : "Yes, check me in"}
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={pending}
            className={`${btnSecondary} w-full`}
          >
            Not me — search again
          </button>
        </form>

        {message && <p className={errorText}>{message}</p>}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-slate-500">
        Registering on a new phone? Find yourself by nickname.
      </p>

      <div>
        <label htmlFor="claim-nickname" className={labelCls}>
          Nickname
        </label>
        <input
          id="claim-nickname"
          name="nickname"
          type="text"
          maxLength={40}
          placeholder="Your nickname"
          className={inputCls}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>

      {message && <p className={errorText}>{message}</p>}

      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
        {pending ? "Searching…" : "Find me"}
      </button>
    </form>
  );
}
