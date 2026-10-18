"use client";

import { useActionState, useEffect, useState } from "react";
import {
  addGroupAction,
  bulkDeleteGroupsAction,
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
  successText,
} from "@/lib/ui";

const idle: MessageState = { status: "idle" };

export function GroupsClient({
  groups,
  counts,
}: {
  groups: Group[];
  counts: Record<string, number>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkDeleteGroupsAction,
    idle
  );

  const selectedGroups = groups.filter((g) => selected.has(g.id));
  const allSelected = groups.length > 0 && groups.every((g) => selected.has(g.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const g of groups) {
        if (allSelected) next.delete(g.id);
        else next.add(g.id);
      }
      return next;
    });
  }

  // Clear the selection after a successful bulk delete (render-phase
  // adjustment — no effect needed, same pattern as AddGroupForm).
  const [prevBulk, setPrevBulk] = useState(bulkState);
  if (bulkState !== prevBulk) {
    setPrevBulk(bulkState);
    if (bulkState.status === "success") setSelected(new Set());
  }

  return (
    <div className="space-y-4">
      <AddGroupForm />

      {groups.length > 0 && (
        <div className={`${cardCls} flex flex-wrap items-center gap-3 px-4 py-2.5`}>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Select all groups"
              className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
            />
            Select all
          </label>

          {selectedGroups.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">
                {selectedGroups.length} selected
              </span>
              <form action={bulkAction}>
                {selectedGroups.map((g) => (
                  <input key={g.id} type="hidden" name="ids" value={g.id} />
                ))}
                <button
                  type="submit"
                  disabled={bulkPending}
                  className={btnDangerSmall}
                  onClick={(e) => {
                    if (
                      !window.confirm(
                        `Delete ${selectedGroups.length} group${
                          selectedGroups.length === 1 ? "" : "s"
                        }? Groups with members are skipped. This cannot be undone.`
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                >
                  {bulkPending ? "Deleting…" : "Delete selected"}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className={btnSmall}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {bulkState.status === "error" && <p className={errorText}>{bulkState.message}</p>}
      {bulkState.status === "success" && bulkState.message && (
        <p className={successText}>{bulkState.message}</p>
      )}

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
              selected={selected.has(group.id)}
              onToggle={toggleOne}
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

function GroupRow({
  group,
  count,
  selected,
  onToggle,
}: {
  group: Group;
  count: number;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
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
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(group.id)}
        aria-label={`Select ${group.name}`}
        className="h-4 w-4 shrink-0 rounded border-slate-300 accent-indigo-600"
      />
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
