"use client";

import { useTransition } from "react";
import type { Habit } from "@/lib/types";
import { toggleHabit } from "@/lib/actions/self";
import { cx } from "../primitives";

export function HabitChecklist({
  habits,
  done,
  date,
  consistency,
}: {
  habits: Habit[];
  done: string[];
  date: string;
  consistency?: Record<string, number | null>;
}) {
  const [pending, startTransition] = useTransition();
  const doneSet = new Set(done);

  if (habits.length === 0) {
    return (
      <p className="text-xs text-ink-faint">
        No active habits. Five to eight is the useful range — more than that is a list, not a system.
      </p>
    );
  }

  return (
    <ul className="space-y-px">
      {habits.map((h) => {
        const isDone = doneSet.has(h.id);
        const c = consistency?.[h.id];
        return (
          <li key={h.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => void toggleHabit(h.id, date))}
              className={cx(
                "flex w-full items-center gap-3 border-b border-line-soft py-2.5 text-left transition-colors last:border-b-0 disabled:opacity-50",
                "hover:bg-raised",
              )}
            >
              <span
                className={cx(
                  "flex h-4 w-4 flex-none items-center justify-center border transition-colors",
                  isDone ? "border-ink bg-ink" : "border-line-strong",
                )}
              >
                {isDone ? (
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-none stroke-inverse" strokeWidth={2}>
                    <path d="M2 6.2 4.6 8.8 10 3.4" />
                  </svg>
                ) : null}
              </span>
              <span className={cx("flex-1 truncate text-sm", isDone ? "text-ink" : "text-ink-dim")}>
                {h.name}
              </span>
              <span className="numeral flex-none text-[0.6875rem] text-ink-faint">
                {c === null || c === undefined ? `${h.target_per_week}×/wk` : `${Math.round(c)}%`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
