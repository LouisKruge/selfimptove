import { clamp, round } from "./stats";

/**
 * PROMISE ENGINE + HABIT ENGINE
 *
 * Character is measured through behaviour that was recorded, not through
 * self-assessment. The promise rate is reliability to oneself; habit
 * consistency is frequency against a stated target — no streak theatre.
 */

export interface PromiseStats {
  total: number;
  kept: number;
  broken: number;
  modified: number;
  open: number;
  /** kept / (kept + broken), 0–100. Null until at least one is resolved. */
  rate: number | null;
  target: number;
  meetsTarget: boolean | null;
  message: string;
}

export const PROMISE_TARGET = 90;

export function promiseStats(
  promises: ReadonlyArray<{ status: string }>,
  target = PROMISE_TARGET,
): PromiseStats {
  const kept = promises.filter((p) => p.status === "KEPT").length;
  const broken = promises.filter((p) => p.status === "BROKEN").length;
  const modified = promises.filter((p) => p.status === "MODIFIED").length;
  const open = promises.filter((p) => p.status === "OPEN").length;
  const resolved = kept + broken;

  const rate = resolved > 0 ? round((kept / resolved) * 100, 1) : null;
  const meetsTarget = rate === null ? null : rate >= target;

  let message: string;
  if (rate === null) {
    message =
      promises.length === 0
        ? "No promises made in this window."
        : `${open} promises still open — none resolved yet.`;
  } else if (meetsTarget) {
    message = `${kept} of ${resolved} kept. Above the ${target}% standard.`;
  } else {
    const needed = Math.max(1, Math.ceil((target / 100) * (resolved + 1) - kept));
    message = `${kept} of ${resolved} kept. ${needed} more consecutive kept ${
      needed === 1 ? "promise" : "promises"
    } to reach ${target}%.`;
  }

  return { total: promises.length, kept, broken, modified, open, rate, target, meetsTarget, message };
}

export interface HabitConsistency {
  habitId: string;
  name: string;
  targetPerWeek: number;
  done7: number;
  done30: number;
  done90: number;
  /** Actual frequency vs target, 0–100, over each window. */
  consistency7: number | null;
  consistency30: number | null;
  consistency90: number | null;
  lastDone: string | null;
  daysSince: number | null;
}

export function habitConsistency(opts: {
  habitId: string;
  name: string;
  targetPerWeek: number;
  /** Dates the habit was completed, most recent first. */
  doneDates: readonly string[];
  today: string;
  /** Days since the habit was created — windows never exceed this. */
  ageDays: number;
}): HabitConsistency {
  const { habitId, name, targetPerWeek, doneDates, today, ageDays } = opts;

  const within = (n: number) =>
    doneDates.filter((d) => dayDiff(today, d) >= 0 && dayDiff(today, d) < n).length;

  const done7 = within(7);
  const done30 = within(30);
  const done90 = within(90);

  const rate = (done: number, windowDays: number) => {
    const effective = Math.min(windowDays, Math.max(1, ageDays));
    const expected = (targetPerWeek / 7) * effective;
    if (expected <= 0) return null;
    // Below one expected completion the window cannot say anything useful.
    if (expected < 1) return null;
    return round(clamp((done / expected) * 100, 0, 100), 1);
  };

  const lastDone = doneDates.length ? doneDates[0] : null;

  return {
    habitId,
    name,
    targetPerWeek,
    done7,
    done30,
    done90,
    consistency7: rate(done7, 7),
    consistency30: rate(done30, 30),
    consistency90: rate(done90, 90),
    lastDone,
    daysSince: lastDone ? dayDiff(today, lastDone) : null,
  };
}

/** Portfolio view across all habits for a window. */
export function habitPortfolio(rows: readonly HabitConsistency[], window: 7 | 30 | 90) {
  const key = `consistency${window}` as const;
  const values = rows.map((r) => r[key]).filter((v): v is number => v !== null);
  const average = values.length ? round(values.reduce((a, b) => a + b, 0) / values.length, 1) : null;
  const weakest = [...rows]
    .filter((r) => r[key] !== null)
    .sort((a, b) => (a[key] as number) - (b[key] as number))[0];
  return { average, weakest: weakest ?? null, measured: values.length, total: rows.length };
}

export interface DecisionQuality {
  decided: number;
  withOutcome: number;
  averageRating: number | null;
  highEmotionCount: number;
  highEmotionAverage: number | null;
  calmAverage: number | null;
  insight: string | null;
}

/** Compares outcome quality of calm decisions against emotionally charged ones. */
export function decisionQuality(
  decisions: ReadonlyArray<{
    status: string;
    outcome_rating: number | null;
    emotional_intensity: number | null;
  }>,
): DecisionQuality {
  const decided = decisions.filter((d) => d.status === "DECIDED");
  const rated = decided.filter((d) => d.outcome_rating !== null);

  const avg = (xs: number[]) =>
    xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length, 2) : null;

  const highEmotion = rated.filter((d) => (d.emotional_intensity ?? 0) >= 4);
  const calm = rated.filter((d) => (d.emotional_intensity ?? 0) <= 2);

  const highAvg = avg(highEmotion.map((d) => d.outcome_rating as number));
  const calmAvg = avg(calm.map((d) => d.outcome_rating as number));

  let insight: string | null = null;
  if (highAvg !== null && calmAvg !== null && highEmotion.length >= 3 && calm.length >= 3) {
    const gap = round(calmAvg - highAvg, 2);
    if (Math.abs(gap) >= 0.5) {
      insight =
        gap > 0
          ? `Decisions made calmly are rating ${gap} points higher than those made under high emotion.`
          : `Decisions made under high emotion are rating ${Math.abs(gap)} points higher than calm ones — worth examining why.`;
    } else {
      insight = "Outcome quality is similar whether calm or emotionally charged.";
    }
  }

  return {
    decided: decided.length,
    withOutcome: rated.length,
    averageRating: avg(rated.map((d) => d.outcome_rating as number)),
    highEmotionCount: highEmotion.length,
    highEmotionAverage: highAvg,
    calmAverage: calmAvg,
    insight,
  };
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);
}
