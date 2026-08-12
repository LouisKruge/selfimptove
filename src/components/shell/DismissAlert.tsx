"use client";

import { useTransition } from "react";
import { dismissAlert } from "@/lib/actions/system";

/**
 * Dismissing an alert hides that specific finding. If the underlying condition
 * recurs after being resolved, a new alert is raised — dismissal silences the
 * message, never the measurement.
 */
export function DismissAlert({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label="Dismiss"
      title="Dismiss"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(() => void dismissAlert(id));
      }}
      className="text-ink-ghost transition-colors hover:text-ink-dim disabled:opacity-40"
    >
      ×
    </button>
  );
}
