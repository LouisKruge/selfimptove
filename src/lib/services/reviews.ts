import "server-only";

import { all, get } from "@/lib/db";
import { insert, update } from "@/lib/db/repo";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  monthLabel,
  nowIso,
  startOfMonth,
  startOfWeek,
  today,
  type DayString,
} from "@/lib/core/date";
import type { Review, ReviewKind, ScoredPillar, Trend } from "@/lib/types";
import { SCORED_PILLARS } from "@/lib/types";
import { averageScores, scoreHistory } from "./scores";
import { primaryMission, computeMissionProgress } from "./core";
import { revenueBetween } from "./business";
import { netWorthNow, incomeBetween, personalExpensesBetween } from "./finance";
import { promiseRate } from "./character";
import { scalar } from "@/lib/db";

export interface ReviewQuestion {
  key: string;
  label: string;
  hint?: string;
  kind: "text" | "long" | "verdict";
}

export const REVIEW_QUESTIONS: Record<ReviewKind, ReviewQuestion[]> = {
  DAILY: [
    { key: "accomplished", label: "What did I accomplish?", kind: "long" },
    { key: "missed", label: "What did I miss?", kind: "long" },
    { key: "why", label: "Why?", kind: "long" },
    { key: "tomorrow", label: "What matters tomorrow?", kind: "long" },
  ],
  WEEKLY: [
    { key: "improved", label: "What improved?", kind: "long" },
    { key: "declined", label: "What declined?", kind: "long" },
    { key: "worked", label: "What worked?", kind: "long" },
    { key: "wasted", label: "What wasted time?", kind: "long" },
    { key: "body", label: "Did BODY improve?", kind: "verdict" },
    { key: "business", label: "Did BUSINESS improve?", kind: "verdict" },
    { key: "finance", label: "Did FINANCE improve?", kind: "verdict" },
    { key: "character", label: "Did CHARACTER improve?", kind: "verdict" },
    { key: "change", label: "What should change next week?", kind: "long" },
  ],
  MONTHLY: [
    { key: "body", label: "BODY", kind: "verdict" },
    { key: "business", label: "BUSINESS", kind: "verdict" },
    { key: "finance", label: "FINANCE", kind: "verdict" },
    { key: "character", label: "CHARACTER", kind: "verdict" },
    { key: "learning", label: "LEARNING", kind: "verdict" },
    { key: "win", label: "Biggest win", kind: "long" },
    { key: "failure", label: "Biggest failure", kind: "long" },
    { key: "lesson", label: "Biggest lesson", kind: "long" },
    { key: "boss_fight", label: "Next month's boss fight", kind: "text" },
  ],
  NINETY_DAY: [
    { key: "body", label: "BODY — day 1 vs day 90", kind: "long" },
    { key: "business", label: "BUSINESS — day 1 vs day 90", kind: "long" },
    { key: "finance", label: "FINANCE — day 1 vs day 90", kind: "long" },
    { key: "character", label: "CHARACTER — day 1 vs day 90", kind: "long" },
    { key: "learning", label: "LEARNING — day 1 vs day 90", kind: "long" },
    {
      key: "verdict",
      label: "Did my life materially improve?",
      hint: "If yes, continue and refine. If no, change strategy.",
      kind: "verdict",
    },
    { key: "next", label: "What changes for the next 90 days?", kind: "long" },
  ],
};

export const VERDICT_OPTIONS: Trend[] = ["UP", "FLAT", "DOWN"];

/* ------------------------------------------------------------- periods */

export function periodFor(kind: ReviewKind, day: DayString): { start: DayString; end: DayString } {
  switch (kind) {
    case "DAILY":
      return { start: day, end: day };
    case "WEEKLY":
      return { start: startOfWeek(day), end: endOfWeek(day) };
    case "MONTHLY":
      return { start: startOfMonth(day), end: endOfMonth(day) };
    case "NINETY_DAY": {
      const mission = primaryMission();
      if (mission) return { start: mission.start_date, end: mission.end_date };
      return { start: addDays(day, -89), end: day };
    }
  }
}

export function periodLabel(kind: ReviewKind, start: DayString, end: DayString): string {
  if (kind === "DAILY") return start;
  if (kind === "MONTHLY") return monthLabel(start);
  return `${start} → ${end}`;
}

/* -------------------------------------------------------------- storage */

export function listReviews(kind?: ReviewKind): Review[] {
  return kind
    ? all<Review>("SELECT * FROM reviews WHERE kind = ? ORDER BY period_start DESC", [kind])
    : all<Review>("SELECT * FROM reviews ORDER BY period_start DESC, kind");
}

export function getReview(id: string): Review | undefined {
  return get<Review>("SELECT * FROM reviews WHERE id = ?", [id]);
}

export function findReview(kind: ReviewKind, start: DayString): Review | undefined {
  return get<Review>("SELECT * FROM reviews WHERE kind = ? AND period_start = ?", [kind, start]);
}

/** Fetches the review for a period, creating the draft if it does not exist. */
export function ensureReview(kind: ReviewKind, day: DayString = today()): Review {
  const { start, end } = periodFor(kind, day);
  const existing = findReview(kind, start);
  if (existing) return existing;
  const id = insert("reviews", {
    kind,
    period_start: start,
    period_end: end,
    status: "DRAFT",
    answers_json: "{}",
  });
  return getReview(id)!;
}

export function saveReviewAnswers(id: string, answers: Record<string, string>): void {
  update("reviews", id, { answers_json: JSON.stringify(answers) });
}

export function completeReview(id: string): void {
  const review = getReview(id);
  if (!review) return;
  update("reviews", id, {
    status: "COMPLETE",
    completed_at: nowIso(),
    snapshot_json: JSON.stringify(reviewSnapshot(review.kind, review.period_start, review.period_end)),
  });
}

export function reviewAnswers(review: Review): Record<string, string> {
  try {
    const parsed = JSON.parse(review.answers_json);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------- snapshot */

export interface PillarDelta {
  pillar: ScoredPillar;
  start: number | null;
  end: number | null;
  average: number | null;
  verdict: Trend | null;
}

export interface ReviewSnapshot {
  period: { start: DayString; end: DayString };
  scores: ReturnType<typeof averageScores>;
  pillars: PillarDelta[];
  sessionsCompleted: number;
  distanceM: number;
  tasksCompleted: number;
  mustWinsCompleted: number;
  revenueCents: number;
  incomeCents: number;
  expensesCents: number;
  netWorthCents: number;
  promiseRate: number | null;
  learningMinutes: number;
  missionProgress: number | null;
  scoredDays: number;
}

const KEY: Record<ScoredPillar, "body" | "business" | "character" | "finance" | "learning"> = {
  BODY: "body",
  BUSINESS: "business",
  CHARACTER: "character",
  FINANCE: "finance",
  LEARNING: "learning",
};

export function reviewSnapshot(
  kind: ReviewKind,
  start: DayString,
  end: DayString,
): ReviewSnapshot {
  const rows = all<{ date: string; [k: string]: unknown }>(
    "SELECT * FROM daily_scores WHERE date BETWEEN ? AND ? ORDER BY date",
    [start, end],
  );

  const pillars: PillarDelta[] = SCORED_PILLARS.map((pillar) => {
    const key = KEY[pillar];
    const values = rows
      .map((r) => r[key] as number | null)
      .filter((v): v is number => v !== null);
    const first = values.length ? values[0] : null;
    const last = values.length ? values[values.length - 1] : null;
    const average = values.length
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
      : null;

    let verdict: Trend | null = null;
    if (values.length >= 4 && first !== null && last !== null) {
      const half = Math.floor(values.length / 2);
      const early = values.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const late =
        values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half);
      const delta = late - early;
      verdict = delta > 3 ? "UP" : delta < -3 ? "DOWN" : "FLAT";
    }
    return { pillar, start: first, end: last, average, verdict };
  });

  const mission = primaryMission();

  return {
    period: { start, end },
    scores: averageScores(start, end),
    pillars,
    sessionsCompleted: scalar(
      "SELECT COUNT(*) AS v FROM workout_sessions WHERE date BETWEEN ? AND ? AND status IN ('COMPLETED','MODIFIED')",
      [start, end],
    ),
    distanceM: scalar(
      "SELECT COALESCE(SUM(distance_m), 0) AS v FROM runs WHERE date BETWEEN ? AND ?",
      [start, end],
    ),
    tasksCompleted: scalar(
      "SELECT COUNT(*) AS v FROM tasks WHERE status = 'COMPLETE' AND substr(completed_at, 1, 10) BETWEEN ? AND ?",
      [start, end],
    ),
    mustWinsCompleted: scalar(
      `SELECT COUNT(*) AS v FROM tasks
        WHERE status = 'COMPLETE' AND priority = 'MUST_WIN'
          AND substr(completed_at, 1, 10) BETWEEN ? AND ?`,
      [start, end],
    ),
    revenueCents: revenueBetween(start, end),
    incomeCents: incomeBetween(start, end),
    expensesCents: personalExpensesBetween(start, end),
    netWorthCents: netWorthNow().netWorthCents,
    promiseRate: promiseRate(Math.max(1, dayDiff(end, start) + 1), end).rate,
    learningMinutes: scalar(
      "SELECT COALESCE(SUM(minutes), 0) AS v FROM learning_items WHERE date BETWEEN ? AND ?",
      [start, end],
    ),
    missionProgress: mission ? computeMissionProgress(mission, end).progressPct : null,
    scoredDays: rows.length,
  };
}

export function storedSnapshot(review: Review): ReviewSnapshot | null {
  if (!review.snapshot_json) return null;
  try {
    return JSON.parse(review.snapshot_json) as ReviewSnapshot;
  } catch {
    return null;
  }
}

/** Which reviews are outstanding right now. */
export function outstandingReviews(day: DayString = today()) {
  const out: Array<{ kind: ReviewKind; start: DayString; end: DayString; label: string }> = [];

  const yesterday = addDays(day, -1);
  if (!findReview("DAILY", yesterday) || findReview("DAILY", yesterday)?.status !== "COMPLETE") {
    out.push({ kind: "DAILY", start: yesterday, end: yesterday, label: `Daily · ${yesterday}` });
  }

  const lastWeekStart = startOfWeek(addDays(day, -7));
  const weekly = findReview("WEEKLY", lastWeekStart);
  if (!weekly || weekly.status !== "COMPLETE") {
    out.push({
      kind: "WEEKLY",
      start: lastWeekStart,
      end: endOfWeek(lastWeekStart),
      label: `Weekly · ${lastWeekStart}`,
    });
  }

  const lastMonthStart = startOfMonth(addDays(startOfMonth(day), -1));
  const monthly = findReview("MONTHLY", lastMonthStart);
  if (!monthly || monthly.status !== "COMPLETE") {
    out.push({
      kind: "MONTHLY",
      start: lastMonthStart,
      end: endOfMonth(lastMonthStart),
      label: `Monthly · ${monthLabel(lastMonthStart)}`,
    });
  }

  return out;
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);
}

/** Day 1 vs Day 90 comparison for the 90-day review. */
export function ninetyDayComparison(start: DayString, end: DayString) {
  const rows = scoreHistory(400, end).filter((r) => r.date >= start && r.date <= end);
  const firstWindow = rows.slice(0, 7);
  const lastWindow = rows.slice(-7);

  const avg = (list: typeof rows, key: "body" | "business" | "character" | "finance" | "learning" | "overall") => {
    const values = list.map((r) => r[key]).filter((v): v is number => v !== null);
    return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
  };

  return {
    hasData: rows.length >= 14,
    scoredDays: rows.length,
    pillars: (["BODY", "BUSINESS", "CHARACTER", "FINANCE", "LEARNING"] as ScoredPillar[]).map(
      (pillar) => {
        const key = KEY[pillar];
        const from = avg(firstWindow, key);
        const to = avg(lastWindow, key);
        return {
          pillar,
          from,
          to,
          delta: from !== null && to !== null ? Math.round((to - from) * 10) / 10 : null,
        };
      },
    ),
    overallFrom: avg(firstWindow, "overall"),
    overallTo: avg(lastWindow, "overall"),
  };
}
