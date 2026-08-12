"use client";

import { useState, useTransition } from "react";
import type { Task } from "@/lib/types";
import { addDays, today } from "@/lib/core/date";
import {
  convertTaskToProject,
  deleteTask,
  rescheduleTask,
  setTaskStatus,
  toggleTask,
} from "@/lib/actions/plan";
import { cx } from "../primitives";

export function TaskToggle({ id, done }: { id: string; done: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label={done ? "Mark as not complete" : "Mark as complete"}
      aria-pressed={done}
      disabled={pending}
      onClick={() => startTransition(() => void toggleTask(id))}
      className={cx(
        "mt-0.5 flex h-4 w-4 flex-none items-center justify-center border transition-colors",
        done ? "border-ink bg-ink" : "border-line-strong hover:border-ink-dim",
        pending && "opacity-40",
      )}
    >
      {done ? (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-none stroke-inverse" strokeWidth={2}>
          <path d="M2 6.2 4.6 8.8 10 3.4" />
        </svg>
      ) : null}
    </button>
  );
}

/** Reschedule, block, delegate upward, or remove — without leaving the list. */
export function TaskMenu({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
      else setOpen(false);
    });
  };

  return (
    <div className="relative flex-none">
      <button
        type="button"
        aria-label="Task actions"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="px-1.5 py-0.5 text-ink-ghost transition-colors hover:text-ink-dim"
      >
        ⋯
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="enter absolute right-0 top-6 z-20 w-52 border border-line-strong bg-panel py-1">
            {[
              { label: "Today", fn: () => rescheduleTask(task.id, today()) },
              { label: "Tomorrow", fn: () => rescheduleTask(task.id, addDays(today(), 1)) },
              { label: "Next week", fn: () => rescheduleTask(task.id, addDays(today(), 7)) },
            ].map((item) => (
              <MenuItem key={item.label} disabled={pending} onClick={() => run(item.fn)}>
                {item.label}
              </MenuItem>
            ))}
            <div className="my-1 border-t border-line" />
            {task.status !== "IN_PROGRESS" ? (
              <MenuItem
                disabled={pending}
                onClick={() => run(() => setTaskStatus(task.id, "IN_PROGRESS"))}
              >
                Start
              </MenuItem>
            ) : null}
            {task.status !== "BLOCKED" ? (
              <MenuItem disabled={pending} onClick={() => run(() => setTaskStatus(task.id, "BLOCKED"))}>
                Mark blocked
              </MenuItem>
            ) : (
              <MenuItem disabled={pending} onClick={() => run(() => setTaskStatus(task.id, "TODO"))}>
                Unblock
              </MenuItem>
            )}
            <MenuItem disabled={pending} onClick={() => run(() => convertTaskToProject(task.id))}>
              Convert to project
            </MenuItem>
            <div className="my-1 border-t border-line" />
            <MenuItem disabled={pending} onClick={() => run(() => setTaskStatus(task.id, "CANCELLED"))}>
              Cancel
            </MenuItem>
            <MenuItem
              danger
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Delete “${task.title}”? This cannot be undone.`)) {
                  run(() => deleteTask(task.id));
                }
              }}
            >
              Delete
            </MenuItem>
            {error ? (
              <p className="px-3 py-2 text-[0.625rem] leading-tight text-critical">{error}</p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "block w-full px-3 py-1.5 text-left text-xs transition-colors disabled:opacity-40",
        danger ? "text-critical hover:bg-raised" : "text-ink-dim hover:bg-raised hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
