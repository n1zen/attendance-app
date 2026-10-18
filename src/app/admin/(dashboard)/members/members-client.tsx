"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  addMemberAction,
  bulkDeleteMembersAction,
  deleteMemberAction,
  updateMemberAction,
} from "@/app/admin/actions";
import type { Group, Member, MessageState } from "@/lib/types";
import { formatIsoDate } from "@/lib/format";
import {
  btnDangerSmall,
  btnPrimary,
  btnSecondary,
  btnSmall,
  cardCls,
  errorText,
  inputCls,
  labelCls,
  successText,
} from "@/lib/ui";

const idle: MessageState = { status: "idle" };

export function MembersClient({
  members,
  groups,
}: {
  members: Member[];
  groups: Group[];
}) {
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkDeleteMembersAction,
    idle
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((member) => {
      if (groupFilter !== "all" && member.groupId !== groupFilter) return false;
      if (!q) return true;
      return (
        member.name.toLowerCase().includes(q) ||
        member.nickname.toLowerCase().includes(q)
      );
    });
  }, [members, query, groupFilter]);

  // Only the currently visible rows count toward a bulk delete — a stale
  // selection hidden by the search/group filter can never be deleted by accident.
  const selectedVisible = filtered.filter((m) => selected.has(m.id));
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((m) => selected.has(m.id));

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
      for (const m of filtered) {
        if (allVisibleSelected) next.delete(m.id);
        else next.add(m.id);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or nickname…"
            aria-label="Search members"
            className={inputCls}
          />
        </div>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          aria-label="Filter by group"
          className={`${inputCls} sm:w-56`}
        >
          <option value="all">All groups</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className={btnPrimary}
        >
          {showAdd ? "Close" : "Add member"}
        </button>
      </div>

      {showAdd && (
        <AddMemberForm groups={groups} onDone={() => setShowAdd(false)} />
      )}

      {filtered.length > 0 && (
        <div className={`${cardCls} flex flex-wrap items-center gap-3 px-4 py-2.5`}>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAll}
              aria-label="Select all shown members"
              className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
            />
            Select all shown
          </label>

          {selectedVisible.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">
                {selectedVisible.length} selected
              </span>
              <form action={bulkAction}>
                {selectedVisible.map((m) => (
                  <input key={m.id} type="hidden" name="ids" value={m.id} />
                ))}
                <button
                  type="submit"
                  disabled={bulkPending}
                  className={btnDangerSmall}
                  onClick={(e) => {
                    if (
                      !window.confirm(
                        `Delete ${selectedVisible.length} member${
                          selectedVisible.length === 1 ? "" : "s"
                        }? Their attendance history will be removed too.`
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

      {filtered.length === 0 ? (
        <div className={`${cardCls} px-5 py-10 text-center`}>
          <p className="text-sm font-medium text-slate-700">
            {members.length === 0 ? "No members yet" : "No members match"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {members.length === 0
              ? "Members appear here as soon as they register by scanning the QR code — or add one manually."
              : "Try a different search or group filter."}
          </p>
        </div>
      ) : (
        <ul className={`${cardCls} divide-y divide-slate-100`}>
          {filtered.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              groups={groups}
              selected={selected.has(member.id)}
              onToggle={toggleOne}
            />
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-400">
        Showing {filtered.length} of {members.length} member
        {members.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function AddMemberForm({
  groups,
  onDone,
}: {
  groups: Group[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(addMemberAction, idle);

  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state, onDone]);

  // Controlled inputs: React 19 resets uncontrolled forms after *any* server
  // action, so a validation error would otherwise wipe what was typed.
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [groupId, setGroupId] = useState("");

  return (
    <form action={action} className={`${cardCls} space-y-4 p-5`}>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Add a member</h2>
        <p className="text-xs text-slate-400">
          Usually members register themselves by scanning — add manually when
          needed.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="new-name" className={labelCls}>
            Full name
          </label>
          <input
            id="new-name"
            name="name"
            type="text"
            maxLength={80}
            placeholder="Jane Doe"
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="new-nickname" className={labelCls}>
            Nickname
          </label>
          <input
            id="new-nickname"
            name="nickname"
            type="text"
            maxLength={40}
            placeholder="Janey"
            className={inputCls}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="new-group" className={labelCls}>
            Group
          </label>
          <select
            id="new-group"
            name="groupId"
            className={inputCls}
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="" disabled>
              Select group…
            </option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.status === "error" && <p className={errorText}>{state.message}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Adding…" : "Add member"}
        </button>
        <button type="button" onClick={onDone} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function MemberRow({
  member,
  groups,
  selected,
  onToggle,
}: {
  member: Member;
  groups: Group[];
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteMemberAction,
    idle
  );

  if (editing) {
    return (
      <MemberEditor
        member={member}
        groups={groups}
        onDone={() => setEditing(false)}
      />
    );
  }

  const joined = formatIsoDate(member.createdAt);

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(member.id)}
        aria-label={`Select ${member.name}`}
        className="h-4 w-4 shrink-0 rounded border-slate-300 accent-indigo-600"
      />
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700"
      >
        {member.name.charAt(0).toUpperCase()}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {member.name}
        </p>
        <p className="truncate text-xs text-slate-500">
          “{member.nickname}” · joined {joined}
        </p>
      </div>

      <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
        {member.groupName}
      </span>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/admin/members/${member.id}`}
          className={btnSmall}
        >
          History
        </Link>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={btnSmall}
        >
          Edit
        </button>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={member.id} />
          <button
            type="submit"
            disabled={deletePending}
            className={btnDangerSmall}
            onClick={(e) => {
              if (
                !window.confirm(
                  `Delete ${member.name}? Their attendance history will be removed too.`
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            {deletePending ? "Deleting…" : "Delete"}
          </button>
        </form>
      </div>

      {deleteState.status === "error" && (
        <p className={`w-full ${errorText}`}>{deleteState.message}</p>
      )}
    </li>
  );
}

function MemberEditor({
  member,
  groups,
  onDone,
}: {
  member: Member;
  groups: Group[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(updateMemberAction, idle);

  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state, onDone]);

  // Controlled inputs: React 19 resets uncontrolled forms after *any* server
  // action, so a failed save would otherwise discard the edits.
  const [name, setName] = useState(member.name);
  const [nickname, setNickname] = useState(member.nickname);
  const [groupId, setGroupId] = useState(member.groupId);

  return (
    <li className="px-4 py-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={member.id} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`edit-name-${member.id}`} className={labelCls}>
              Full name
            </label>
            <input
              id={`edit-name-${member.id}`}
              name="name"
              type="text"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={`edit-nickname-${member.id}`} className={labelCls}>
              Nickname
            </label>
            <input
              id={`edit-nickname-${member.id}`}
              name="nickname"
              type="text"
              maxLength={40}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={`edit-group-${member.id}`} className={labelCls}>
              Group
            </label>
            <select
              id={`edit-group-${member.id}`}
              name="groupId"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className={inputCls}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {state.status === "error" && (
          <p className={errorText}>{state.message}</p>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={pending} className={btnSmall}>
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={onDone} className={btnSmall}>
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}
