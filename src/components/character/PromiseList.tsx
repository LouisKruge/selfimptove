"use client";

import { useTransition } from "react";
import type { Promise_ } from "@/lib/types";
import { formatDayShort } from "@/lib/core/date";
import { deletePromise, resolvePromise } from "@/lib/actions/self";
import { Badge, cx } from "../primitives";

/**
 * A promise is only a measurement once it is resolved. Open promises are shown
 * but never counted — the promise rate is kept / (kept + broken).
 */
export function PromiseList({
  promises,
  showDate,
  allowDelete,
}: {
  promises: Promise_[];
  showDate?: boolean;
  allowDelete?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (promises.length === 0) {
    return <p className="text-xs text-ink-faint">No promises recorded.</p>;
  }

  return (
    <ul className="space-y-px">
      {promises.map((p) => (
        <li
          key={p.id}
          className="flex flex-wrap items-center gap-3 border-b border-line-soft py-3 last:border-b-0"
        >
          <div className="min-w-0 flex-1">
            <div
              className={cx(
                "text-sm leading-snug",
                p.status === "BROKEN" ? "text-ink-faint" : "text-ink",
              )}
            >
              {p.text}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="label">{p.pillar}</span>
              {p.due_time ? (
                <span className="numeral text-[0.6875rem] text-ink-faint">{p.due_time}</span>
              ) : null}
              {showDate ? (
                <span className="text-[0.6875rem] text-ink-faint">{formatDayShort(p.date)}</span>
              ) : null}
            </div>
          </div>

          {p.status === "OPEN" ? (
            <div className="flex flex-none items-center gap-1.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => void resolvePromise(p.id, "KEPT"))}
                className="btn"
              >
                Kept
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => void resolvePromise(p.id, "BROKEN"))}
                className="btn btn-ghost"
              >
                Broken
              </button>
            </div>
          ) : (
            <div className="flex flex-none items-center gap-2">
              <Badge
                tone={
                  p.status === "KEPT" ? "positive" : p.status === "BROKEN" ? "critical" : "muted"
                }
              >
                {p.status}
              </Badge>
              <button
                type="button"
                disabled={pending}
                title="Reopen"
                onClick={() => startTransition(() => void resolvePromise(p.id, "OPEN"))}
                className="text-[0.625rem] uppercase tracking-[0.12em] text-ink-ghost hover:text-ink-dim"
              >
                Undo
              </button>
            </div>
          )}

          {allowDelete ? (
            <button
              type="button"
              disabled={pending}
              aria-label="Delete promise"
              onClick={() => startTransition(() => void deletePromise(p.id))}
              className="flex-none text-ink-ghost transition-colors hover:text-critical"
            >
              ×
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
