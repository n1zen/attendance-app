"use client";

import { useActionState, useEffect, useState } from "react";
import {
  addGroupAction,
  deleteGroupAction,
  renameGroupAction,
} from "@/app/admin/actions";
import type { Group, MessageState } from "@/lib/types";
import {
  btnDangerSmall,
  btnPrimary,
  btnSmall,
  cardCls,
  errorText,
  inputCls,
} from "@/lib/ui";

const idle: MessageState = { status: "idle" };

export function GroupsClient({
  groups,
  counts,
}: {
  groups: Group[];
  counts: Record<string, number>;
}) {
  return (
    <div className="space-y-4">
      <AddGroupForm />

      {groups.length === 0 ? (
        <div className={`${cardCls} px-5 py-10 text-center`}>
          <p className="text-sm font-medium text-slate-700">No groups yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Create the first group — members choose theirs when they register.
          </p>
        </div>
      ) : (
        <ul className={`${cardCls} divide-y divide-slate-100`}>
          {groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              count={counts[group.id] ?? 0}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddGroupForm() {
  const [state, action, pending] = useActionState(addGroupAction, idle);

  // Controlled input: React 19 resets uncontrolled forms after *any* server
  // action, so a validation error would otherwise wipe what was typed.
  const [name, setName] = useState("");
  // Clear only on success (render-phase adjustment — no effect needed).
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setName("");
  }

  return (
    <form action={action} className={`${cardCls} flex flex-col gap-3 p-4 sm:flex-row sm:items-start`}>
      <div className="flex-1">
        <label htmlFor="group-name" className="sr-only">
          Group name
        </label>
        <input
          id="group-name"
          name="name"
          type="text"
          maxLength={50}
          placeholder="New group name…"
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {state.status === "error" && (
          <p className={`mt-1 ${errorText}`}>{state.message}</p>
        )}
      </div>
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Adding…" : "Add group"}
      </button>
    </form>
  );
}

function GroupRow({ group, count }: { group: Group; count: number }) {
  const [editing, setEditing] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteGroupAction,
    idle
  );

  if (editing) {
    return <GroupEditor group={group} onDone={() => setEditing(false)} />;
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {group.name}
        </p>
        <p className="text-xs text-slate-500">
          {count} member{count === 1 ? "" : "s"}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setEditing(true)}
        className={btnSmall}
      >
        Rename
      </button>

      <form action={deleteAction}>
        <input type="hidden" name="id" value={group.id} />
        <button
          type="submit"
          disabled={deletePending}
          className={btnDangerSmall}
          onClick={(e) => {
            if (
              !window.confirm(
                `Delete “${group.name}”? This cannot be undone.`
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          {deletePending ? "Deleting…" : "Delete"}
        </button>
      </form>

      {deleteState.status === "error" && (
        <p className={`w-full ${errorText}`}>{deleteState.message}</p>
      )}
    </li>
  );
}

function GroupEditor({
  group,
  onDone,
}: {
  group: Group;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(renameGroupAction, idle);

  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state, onDone]);

  // Controlled so a failed rename keeps the edits (React 19 resets
  // uncontrolled forms after any server action, including errors).
  const [name, setName] = useState(group.name);

  return (
    <li className="px-4 py-3">
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <input type="hidden" name="id" value={group.id} />
        <div className="flex-1">
          <label htmlFor={`rename-${group.id}`} className="sr-only">
            Group name
          </label>
          <input
            id={`rename-${group.id}`}
            name="name"
            type="text"
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            autoFocus
          />
          {state.status === "error" && (
            <p className={`mt-1 ${errorText}`}>{state.message}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className={btnSmall}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onDone} className={btnSmall}>
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}
