"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_NAV_ITEMS } from "@/lib/nav";
import { cx } from "../primitives";

/**
 * COMMAND PALETTE
 *
 * One keystroke to anything: navigation, a quick log, a review, or a global
 * search across every entity. Quick actions land on the screen with the right
 * form already open, so logging stays a few seconds' work.
 */

interface Entry {
  id: string;
  group: string;
  label: string;
  detail?: string;
  href: string;
  keywords?: string[];
}

const QUICK_ACTIONS: Entry[] = [
  { id: "a-start-workout", group: "Log", label: "Start Workout", href: "/body/training?quick=start", keywords: ["train", "gym", "session", "begin"] },
  { id: "a-log-workout", group: "Log", label: "Log Workout", href: "/body/training?quick=schedule", keywords: ["session", "plan"] },
  { id: "a-log-set", group: "Log", label: "Log Set", href: "/body/training?quick=set", keywords: ["reps", "weight"] },
  { id: "a-log-run", group: "Log", label: "Log Run", href: "/body/running?quick=run", keywords: ["distance", "pace"] },
  { id: "a-log-hyrox", group: "Log", label: "Log HYROX", href: "/body/hyrox?quick=session", keywords: ["race", "simulation", "station"] },
  { id: "a-log-meal", group: "Log", label: "Log Meal", href: "/body/nutrition?quick=meal", keywords: ["food", "protein", "macros", "calories"] },
  { id: "a-log-weight", group: "Log", label: "Log Weight", href: "/body/measurements?quick=weight", keywords: ["scale", "bodyweight"] },
  { id: "a-log-recovery", group: "Log", label: "Log Sleep & Recovery", href: "/body/recovery?quick=recovery", keywords: ["sleep", "readiness", "energy"] },
  { id: "a-add-task", group: "Log", label: "Add Task", href: "/today?quick=task", keywords: ["todo", "big 3", "must win"] },
  { id: "a-add-expense", group: "Log", label: "Add Expense", href: "/finance/cash-flow?quick=expense", keywords: ["spend", "cost"] },
  { id: "a-log-income", group: "Log", label: "Log Income", href: "/finance/cash-flow?quick=income", keywords: ["earned", "salary"] },
  { id: "a-log-revenue", group: "Log", label: "Log Revenue", href: "/business/revenue?quick=revenue", keywords: ["sale", "paid", "invoice"] },
  { id: "a-add-lead", group: "Log", label: "Add Lead", href: "/business/sales?quick=lead", keywords: ["prospect", "crm", "pipeline"] },
  { id: "a-add-idea", group: "Log", label: "Add Idea", href: "/ideas?quick=idea", keywords: ["capture", "vault"] },
  { id: "a-add-decision", group: "Log", label: "Create Decision", href: "/character/decisions?quick=decision", keywords: ["firewall", "choice", "impulse"] },
  { id: "a-add-promise", group: "Log", label: "Make a Promise", href: "/character?quick=promise", keywords: ["commit", "reliability"] },
  { id: "a-log-learning", group: "Log", label: "Log Learning", href: "/learning?quick=learning", keywords: ["study", "skill", "practice"] },
  { id: "a-review-daily", group: "Review", label: "Start Daily Review", href: "/reviews?start=DAILY" },
  { id: "a-review-weekly", group: "Review", label: "Start Weekly Review", href: "/reviews?start=WEEKLY" },
  { id: "a-review-monthly", group: "Review", label: "Start Monthly Review", href: "/reviews?start=MONTHLY" },
  { id: "a-review-90", group: "Review", label: "Start 90-Day Review", href: "/reviews?start=NINETY_DAY" },
];

const NAV_ENTRIES: Entry[] = ALL_NAV_ITEMS.map((i) => ({
  id: `nav-${i.href}`,
  group: `Go · ${i.group}`,
  label: i.label,
  href: i.href,
  keywords: i.keywords,
}));

const BASE_ENTRIES = [...QUICK_ACTIONS, ...NAV_ENTRIES];

function score(entry: Entry, q: string): number {
  const haystack = `${entry.label} ${entry.group} ${(entry.keywords ?? []).join(" ")}`.toLowerCase();
  const label = entry.label.toLowerCase();
  if (label === q) return 0;
  if (label.startsWith(q)) return 1;
  if (label.includes(q)) return 2;
  if (haystack.includes(q)) return 3;
  return Infinity;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [remote, setRemote] = useState<Entry[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCursor(0);
      setRemote([]);
    }
  }, [open]);

  // Global search runs on the server; local entries filter instantly.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setRemote([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          results: Array<{ id: string; type: string; title: string; subtitle: string | null; href: string }>;
        };
        setRemote(
          data.results.map((r) => ({
            id: `remote-${r.type}-${r.id}`,
            group: r.type,
            label: r.title,
            detail: r.subtitle ?? undefined,
            href: r.href,
          })),
        );
      } catch {
        /* aborted or offline — local results still work */
      }
    }, 140);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const local = q
      ? BASE_ENTRIES.map((e) => ({ e, s: score(e, q) }))
          .filter((x) => x.s !== Infinity)
          .sort((a, b) => a.s - b.s)
          .slice(0, 14)
          .map((x) => x.e)
      : BASE_ENTRIES.slice(0, 12);
    return [...local, ...remote];
  }, [query, remote]);

  useEffect(() => {
    setCursor(0);
  }, [entries.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(entries.length - 1, c + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = entries[cursor];
        if (target) {
          onClose();
          router.push(target.href);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, entries, cursor, onClose, router]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-overlay"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="enter relative flex max-h-[70vh] w-full max-w-xl flex-col border border-line-strong bg-panel"
      >
        <div className="flex flex-none items-center gap-3 border-b border-line px-4">
          <span className="text-ink-ghost">⌕</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, log or navigate…"
            className="!border-0 !bg-transparent !px-0 !py-3.5 text-sm focus:!bg-transparent"
          />
          <kbd className="numeral flex-none border border-line px-1.5 py-0.5 text-[0.625rem] text-ink-ghost">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto py-2">
          {entries.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-ink-ghost">
              Nothing matches “{query}”.
            </p>
          ) : (
            entries.map((entry, i) => {
              const showGroup = entry.group !== lastGroup;
              lastGroup = entry.group;
              return (
                <div key={entry.id}>
                  {showGroup ? <div className="label px-4 pb-1.5 pt-3">{entry.group}</div> : null}
                  <button
                    type="button"
                    data-active={i === cursor}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => {
                      onClose();
                      router.push(entry.href);
                    }}
                    className={cx(
                      "flex w-full items-baseline gap-3 px-4 py-2 text-left text-sm transition-colors",
                      i === cursor ? "bg-raised text-ink" : "text-ink-dim",
                    )}
                  >
                    <span className="truncate">{entry.label}</span>
                    {entry.detail ? (
                      <span className="ml-auto truncate text-[0.6875rem] text-ink-ghost">
                        {entry.detail}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-none items-center gap-4 border-t border-line px-4 py-2 text-[0.625rem] uppercase tracking-[0.12em] text-ink-ghost">
          <span>↑↓ move</span>
          <span>⏎ open</span>
          <span className="ml-auto">g then h · t · b · m</span>
        </div>
      </div>
    </div>
  );
}
