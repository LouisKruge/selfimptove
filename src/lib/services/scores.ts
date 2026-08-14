import "server-only";

import { all, get, scalar } from "@/lib/db";
import { insert, update } from "@/lib/db/repo";
import { addDays, lastNDays, nowIso, today, type DayString } from "@/lib/core/date";
import {
  overallScore,
  scoreBody,
  scoreBusiness,
  scoreCharacter,
  scoreFinance,
  scoreLearning,
  weightsFromSeason,
  type PillarScore,
} from "@/lib/domain/scoring";
import { trajectory } from "@/lib/domain/trajectory";
import { analyseBalance, type PillarSnapshot } from "@/lib/domain/balance";
import type { DailyScore, ScoredPillar, Trend } from "@/lib/types";
import { SCORED_PILLARS } from "@/lib/types";
import { activeSeason, getSettingNumber } from "./core";
import { nutritionTargetFor } from "./body";
import { characterDayCounts } from "./character";
import { pipelineTouches } from "./business";
import { learningStats } from "./growth";
import {
  cashOnHandCents,
  debtBalanceAsOf,
  emergencyBufferTargetCents,
  forecast,
  incomeBetween,
  personalExpensesBetween,
  totalDebtCents,
} from "./finance";


/**
 * Did the user record anything at all on this day?
 *
 * A day with no footprint is a day COMMAND knows nothing about. Scoring it
 * would assert a failure the user never had — so every pillar returns null and
 * the day is simply excluded from averages and trends.
 */
const ACTIVITY_PROBES: ReadonlyArray<readonly [table: string, column: string]> = [
  ["workout_sessions", "date"],
  ["workout_sets", "date"],
  ["runs", "date"],
  ["hyrox_sessions", "date"],
  ["nutrition_logs", "date"],
  ["recovery_logs", "date"],
  ["body_measurements", "date"],
  ["tasks", "scheduled_date"],
  ["habit_logs", "date"],
  ["promises", "date"],
  ["learning_items", "date"],
  ["revenue_entries", "date"],
  ["personal_expenses", "date"],
  ["income_entries", "date"],
  ["lead_stage_events", "date"],
  ["reviews", "period_start"],
];

/**
 * Sixteen counts summed in a single statement rather than sixteen queries.
 * Rebuilding a season of scores asks this question once per day, and against a
 * networked database the difference is one round trip instead of sixteen.
 */
const ACTIVITY_SQL = `SELECT ${ACTIVITY_PROBES.map(
  ([table, column]) => `(SELECT COUNT(*) FROM ${table} WHERE ${column} = ?)`,
).join(" + ")} AS v`;

async function dayHasActivity(day: DayString): Promise<boolean> {
  return (await scalar(ACTIVITY_SQL, ACTIVITY_PROBES.map(() => day))) > 0;
}

const EMPTY_PILLAR: PillarScore = { score: null, components: [] };

export interface DayScoreResult {
  date: DayString;
  body: PillarScore;
  business: PillarScore;
  character: PillarScore;
  finance: PillarScore;
  learning: PillarScore;
  overall: number | null;
}

/**
 * Computes every pillar score for a single day from the rows recorded against
 * it. Nothing here reads a stored score — this is always derived.
 */
export async function computeDayScore(day: DayString = today()): Promise<DayScoreResult> {
  if (!(await dayHasActivity(day))) {
    return {
      date: day,
      body: EMPTY_PILLAR,
      business: EMPTY_PILLAR,
      character: EMPTY_PILLAR,
      finance: EMPTY_PILLAR,
      learning: EMPTY_PILLAR,
      overall: null,
    };
  }

  /* ---------------------------------------------------------------- body */
  const sessions = await all<{ status: string }>(
      "SELECT status FROM workout_sessions WHERE date = ?",
      [day],
    );
  const planned = sessions.filter(
    (s) => s.status === "PLANNED" || s.status === "IN_PROGRESS" || s.status === "COMPLETED" || s.status === "MODIFIED" || s.status === "SKIPPED",
  ).length;
  const completed = sessions.filter(
    (s) => s.status === "COMPLETED" || s.status === "MODIFIED",
  ).length;
  const skipped = sessions.filter((s) => s.status === "SKIPPED").length;

  const nutrition = await get<{ calories: number; protein_g: number }>(
      "SELECT calories, protein_g FROM nutrition_logs WHERE date = ?",
      [day],
    );
  const target = await nutritionTargetFor(day);
  const recovery = await get<{ sleep_hours: number | null; is_rest_day: number }>(
      "SELECT sleep_hours, is_rest_day FROM recovery_logs WHERE date = ?",
      [day],
    );

  const body = scoreBody({
    plannedSessions: planned,
    completedSessions: completed,
    skippedSessions: skipped,
    isRestDay: (recovery?.is_rest_day ?? 0) === 1,
    proteinG: nutrition?.protein_g ?? null,
    proteinTargetG: target?.protein_g ?? null,
    calories: nutrition?.calories ?? null,
    calorieTarget: target?.calories ?? null,
    sleepHours: recovery?.sleep_hours ?? null,
    sleepTargetHours: await getSettingNumber("sleep_target_hours", 8),
  });

  /* ------------------------------------------------------------ business */
  const tasks = await all<{ priority: string; status: string }>(
      "SELECT priority, status FROM tasks WHERE scheduled_date = ? AND status <> 'CANCELLED'",
      [day],
    );
  const mustWin = tasks.filter((t) => t.priority === "MUST_WIN");
  const support = tasks.filter((t) => t.priority === "SUPPORT");

  const business = scoreBusiness({
    mustWinScheduled: mustWin.length,
    mustWinComplete: mustWin.filter((t) => t.status === "COMPLETE").length,
    supportScheduled: support.length,
    supportComplete: support.filter((t) => t.status === "COMPLETE").length,
    pipelineTouchesToday: await pipelineTouches(day),
    openLeads: await scalar(
          "SELECT COUNT(*) AS v FROM leads WHERE stage NOT IN ('LOST','RETAINED')",
        ),
    revenueTodayCents: await scalar(
          "SELECT COALESCE(SUM(amount_cents), 0) AS v FROM revenue_entries WHERE date = ?",
          [day],
        ),
    deepWorkMinutes: null,
  });

  /* ----------------------------------------------------------- character */
  const counts = await characterDayCounts(day);
  const dailyReview = await get<{ status: string }>(
      "SELECT status FROM reviews WHERE kind = 'DAILY' AND period_start = ?",
      [day],
    );
  const character = scoreCharacter({
    ...counts,
    reviewCompleted: dailyReview ? dailyReview.status === "COMPLETE" : day < today() ? false : null,
  });

  /* ------------------------------------------------------------- finance */
  const hasFinanceData =
    await scalar("SELECT COUNT(*) AS v FROM accounts") +
      await scalar("SELECT COUNT(*) AS v FROM debts") +
      await scalar("SELECT COUNT(*) AS v FROM income_entries") >
    0;

  const finance = hasFinanceData
    ? scoreFinance({
        projectedLowCents:
          await scalar("SELECT COUNT(*) AS v FROM accounts") > 0 ? (await forecast(30, day)).lowestCents : null,
        bufferTargetCents: await emergencyBufferTargetCents(),
        debtNowCents: await scalar("SELECT COUNT(*) AS v FROM debts") > 0 ? await totalDebtCents() : null,
        debtPriorCents:
          await scalar("SELECT COUNT(*) AS v FROM debts") > 0 ? await debtBalanceAsOf(addDays(day, -30)) : null,
        incomeCents: await incomeBetween(addDays(day, -29), day),
        expensesCents: await personalExpensesBetween(addDays(day, -29), day),
        savingsRateTarget: await getSettingNumber("savings_rate_target", 0.2),
      })
    : scoreFinance({
        projectedLowCents: null,
        bufferTargetCents: 0,
        debtNowCents: null,
        debtPriorCents: null,
        incomeCents: null,
        expensesCents: null,
        savingsRateTarget: 0.2,
      });

  /* ------------------------------------------------------------ learning */
  const ls = await learningStats(day);
  const learning = scoreLearning({
    activeDays7: ls.activeDays7,
    targetDaysPerWeek: await getSettingNumber("learning_days_target", 5),
    minutes7: ls.minutes7,
    targetMinutesPerWeek: await getSettingNumber("learning_minutes_target", 300),
    applied30: ls.applied30,
    total30: ls.total30,
  });

  const weights = weightsFromSeason(await activeSeason(day));
  const overall = overallScore(
    {
      BODY: body.score,
      BUSINESS: business.score,
      CHARACTER: character.score,
      FINANCE: finance.score,
      LEARNING: learning.score,
    },
    weights,
  );

  return { date: day, body, business, character, finance, learning, overall };
}

/** Computes and persists a day's score. Idempotent. */
export async function recomputeDayScore(day: DayString = today()): Promise<DayScoreResult> {
  const result = await computeDayScore(day);
  const detail = JSON.stringify({
    body: result.body.components,
    business: result.business.components,
    character: result.character.components,
    finance: result.finance.components,
    learning: result.learning.components,
  });

  const existing = await get<{ id: string }>("SELECT id FROM daily_scores WHERE date = ?", [day]);
  const values = {
    date: day,
    body: result.body.score,
    business: result.business.score,
    finance: result.finance.score,
    character: result.character.score,
    learning: result.learning.score,
    overall: result.overall,
    detail_json: detail,
    computed_at: nowIso(),
  };
  if (existing) await update("daily_scores", existing.id, values);
  else await insert("daily_scores", values);

  return result;
}

/** Recomputes a trailing window — used after any change that affects history. */
export async function recomputeRecent(days = 3, day: DayString = today()): Promise<void> {
  for (const d of lastNDays(days, day)) await recomputeDayScore(d);
}

/* ------------------------------------------------------------------ reads */

export async function storedScore(day: DayString): Promise<DailyScore | undefined> {
  return await get<DailyScore>("SELECT * FROM daily_scores WHERE date = ?", [day]);
}

export async function scoreHistory(days: number, day: DayString = today()): Promise<DailyScore[]> {
  return await all<DailyScore>(
      "SELECT * FROM daily_scores WHERE date BETWEEN ? AND ? ORDER BY date",
      [addDays(day, -(days - 1)), day],
    );
}

export type SeriesKey = "body" | "business" | "finance" | "character" | "learning" | "overall";

export async function scoreSeries(key: SeriesKey, days: number, day: DayString = today()) {
  const rows = await scoreHistory(days, day);
  const map = new Map(rows.map((r) => [r.date, r[key]]));
  return lastNDays(days, day).map((d) => ({ date: d, value: map.get(d) ?? null }));
}

export interface PillarTrajectory {
  pillar: ScoredPillar;
  score: number | null;
  trend: Trend | null;
  detail: string;
  average: number | null;
}

const KEY_BY_PILLAR: Record<ScoredPillar, SeriesKey> = {
  BODY: "body",
  BUSINESS: "business",
  CHARACTER: "character",
  FINANCE: "finance",
  LEARNING: "learning",
};

export async function pillarTrajectories(days = 28, day: DayString = today()): Promise<PillarTrajectory[]> {
  const rows = await scoreHistory(days, day);
  const latest = await storedScore(day) ?? rows[rows.length - 1];

  return SCORED_PILLARS.map((pillar) => {
    const key = KEY_BY_PILLAR[pillar];
    const series = rows.map((r) => r[key]);
    const t = trajectory(series);
    return {
      pillar,
      score: (latest?.[key] as number | null) ?? null,
      trend: t.trend,
      detail: t.detail,
      average: t.recentAverage,
    };
  });
}

export async function overallTrajectory(days = 28, day: DayString = today()) {
  return trajectory((await scoreHistory(days, day)).map((r) => r.overall));
}

export async function balanceNow(days = 28, day: DayString = today()) {
  const snapshots: PillarSnapshot[] = (await pillarTrajectories(days, day)).map((p) => ({
    pillar: p.pillar,
    score: p.score,
    trend: p.trend,
  }));
  return analyseBalance(snapshots);
}

/** Average pillar scores across an arbitrary window — used by reviews. */
export async function averageScores(from: DayString, to: DayString) {
  const row = await get<{
      body: number | null;
      business: number | null;
      finance: number | null;
      character: number | null;
      learning: number | null;
      overall: number | null;
      days: number;
    }>(
      `SELECT AVG(body) AS body, AVG(business) AS business, AVG(finance) AS finance,
            AVG(character) AS character, AVG(learning) AS learning, AVG(overall) AS overall,
            COUNT(*) AS days
       FROM daily_scores WHERE date BETWEEN ? AND ?`,
      [from, to],
    );
  const r = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
  return {
    body: r(row?.body ?? null),
    business: r(row?.business ?? null),
    finance: r(row?.finance ?? null),
    character: r(row?.character ?? null),
    learning: r(row?.learning ?? null),
    overall: r(row?.overall ?? null),
    days: row?.days ?? 0,
  };
}

export async function currentStreak(minScore = 60, day: DayString = today()): Promise<number> {
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = addDays(day, -i);
    const row = await storedScore(d);
    if (!row || row.overall === null) break;
    if (row.overall < minScore) break;
    streak++;
  }
  return streak;
}
