import "server-only";

import { today, type DayString } from "@/lib/core/date";
import type { Mission, Notification, Season, Task, WorkoutSession } from "@/lib/types";
import {
  activeSeason,
  bigThree,
  computeMissionProgress,
  dayLoad,
  flagTasks,
  goalTree,
  listGoals,
  openTasks,
  primaryMission,
  unalignedProjects,
} from "./core";
import type { MissionProgress } from "@/lib/domain/mission";
import { bodyDashboard, sessionDetail } from "./body";
import { businessDashboard, nextSalesActions } from "./business";
import { financeDashboard } from "./finance";
import { characterDashboard } from "./character";
import { learningStats } from "./growth";
import {
  balanceNow,
  currentStreak,
  overallTrajectory,
  pillarTrajectories,
  recomputeDayScore,
  storedScore,
} from "./scores";
import { syncNotifications } from "./notifications";
import { outstandingReviews } from "./reviews";
import { formatTarget } from "@/lib/domain/progression";

export interface NextTrainingTarget {
  sessionId: string;
  sessionName: string;
  exerciseId: string;
  exerciseName: string;
  target: string;
  last: string | null;
  rationale: string;
}

export interface CommandCenter {
  date: DayString;
  season: Season | undefined;
  mission: Mission | undefined;
  missionProgress: MissionProgress | null;
  bigThree: Awaited<ReturnType<typeof bigThree>>;
  scores: {
    body: number | null;
    business: number | null;
    character: number | null;
    finance: number | null;
    learning: number | null;
    overall: number | null;
  };
  trajectories: Awaited<ReturnType<typeof pillarTrajectories>>;
  overallTrend: Awaited<ReturnType<typeof overallTrajectory>>;
  balance: Awaited<ReturnType<typeof balanceNow>>;
  streak: number;
  training: {
    sessions: WorkoutSession[];
    nextTarget: NextTrainingTarget | null;
    readiness: Awaited<ReturnType<typeof bodyDashboard>>["readiness"];
    loadStatus: string;
  };
  nutrition: Awaited<ReturnType<typeof bodyDashboard>>["nutrition"];
  business: {
    mrrCents: number;
    mrrTargetCents: number | null;
    revenueThisMonthCents: number;
    openLeads: number;
    nextAction: Awaited<ReturnType<typeof nextSalesActions>>[number] | null;
  };
  finance: {
    cashCents: number;
    netWorthCents: number;
    shortfall: { date: string; amountCents: number } | null;
    savingsRate: number | null;
  };
  character: {
    promiseRate: number | null;
    habitsDone: number;
    habitsDue: number;
    disciplineScore: number | null;
  };
  learning: Awaited<ReturnType<typeof learningStats>>;
  alerts: Notification[];
  outstandingReviews: Awaited<ReturnType<typeof outstandingReviews>>;
  attention: {
    overdueTasks: number;
    blockedTasks: number;
    unalignedProjects: number;
    dayLoad: Awaited<ReturnType<typeof dayLoad>>;
  };
  activeGoals: number;
}

/**
 * Assembles the Command Center. This is the one place the whole system is read
 * at once — everything else is a drill-down from here.
 */
export async function commandCenter(day: DayString = today()): Promise<CommandCenter> {
  // Recompute today's score on read so the dashboard is never stale.
  await recomputeDayScore(day);
  const stored = await storedScore(day);

  const season = await activeSeason(day);
  const mission = await primaryMission();
  const body = await bodyDashboard(day);
  const business = await businessDashboard(day);
  const finance = await financeDashboard(day);
  const character = await characterDashboard(day);
  const tasks = await openTasks();
  const flagged = flagTasks(tasks, day);

  const habitsDone = character.habits.filter((h) => h.done7 > 0 && h.daysSince === 0).length;

  return {
    date: day,
    season,
    mission,
    missionProgress: mission ? await computeMissionProgress(mission, day) : null,
    bigThree: await bigThree(day),
    scores: {
      body: stored?.body ?? null,
      business: stored?.business ?? null,
      character: stored?.character ?? null,
      finance: stored?.finance ?? null,
      learning: stored?.learning ?? null,
      overall: stored?.overall ?? null,
    },
    trajectories: await pillarTrajectories(28, day),
    overallTrend: await overallTrajectory(28, day),
    balance: await balanceNow(28, day),
    streak: await currentStreak(60, day),
    training: {
      sessions: body.todaySessions,
      nextTarget: await nextTrainingTarget(body.todaySessions),
      readiness: body.readiness,
      loadStatus: body.load.message,
    },
    nutrition: body.nutrition,
    business: {
      mrrCents: business.mrrCents,
      mrrTargetCents: business.mrrTargetCents,
      revenueThisMonthCents: business.revenueThisMonthCents,
      openLeads: business.pipeline.totalOpen,
      nextAction: business.nextActions[0] ?? null,
    },
    finance: {
      cashCents: finance.now.cashCents,
      netWorthCents: finance.now.netWorthCents,
      shortfall: finance.forecast30.shortfall,
      savingsRate: finance.savingsRate,
    },
    character: {
      promiseRate: character.promises30.rate,
      habitsDone,
      habitsDue: character.habits.length,
      disciplineScore: character.disciplineScore,
    },
    learning: await learningStats(day),
    alerts: await syncNotifications(day),
    outstandingReviews: await outstandingReviews(day),
    attention: {
      overdueTasks: flagged.filter((f) => f.flags.includes("OVERDUE")).length,
      blockedTasks: flagged.filter((f) => f.flags.includes("BLOCKED")).length,
      unalignedProjects: (await unalignedProjects(mission?.id ?? null)).length,
      dayLoad: await dayLoad(day),
    },
    activeGoals: (await listGoals({ status: "ACTIVE" })).length,
  };
}

/** The single most useful training number: what to hit on the first lift today. */
async function nextTrainingTarget(sessions: readonly WorkoutSession[]): Promise<NextTrainingTarget | null> {
  const session =
    sessions.find((s) => s.status === "IN_PROGRESS") ??
    sessions.find((s) => s.status === "PLANNED") ??
    null;
  if (!session) return null;

  const detail = await sessionDetail(session.id);
  if (!detail) return null;

  // First exercise with sets still outstanding.
  const pending = detail.exercises.find(
    (e) => e.sets.filter((s) => !s.is_warmup).length < e.sessionExercise.target_sets,
  );
  if (!pending) return null;

  const lastSummary = pending.last
    ? pending.last.sets
        .filter((s) => !s.is_warmup)
        .map((s) =>
          s.weight_kg && s.reps ? `${s.weight_kg}kg × ${s.reps}` : `${s.reps ?? "—"} reps`,
        )
        .join("  ·  ")
    : null;

  return {
    sessionId: session.id,
    sessionName: session.name,
    exerciseId: pending.exercise.id,
    exerciseName: pending.exercise.name,
    target: formatTarget({
      weightKg: pending.progression.weightKg,
      repMin: pending.progression.repMin,
      repMax: pending.progression.repMax,
      targetSeconds: pending.sessionExercise.target_seconds,
      targetDistanceM: pending.sessionExercise.target_distance_m,
    }),
    last: lastSummary,
    rationale: pending.progression.rationale,
  };
}

export interface TodayView {
  date: DayString;
  season: Season | undefined;
  mission: Mission | undefined;
  missionProgress: MissionProgress | null;
  score: number | null;
  streak: number;
  big3: Awaited<ReturnType<typeof bigThree>>;
  flagged: Awaited<ReturnType<typeof flagTasks>>;
  sessions: WorkoutSession[];
  nutrition: Awaited<ReturnType<typeof bodyDashboard>>["nutrition"];
  readiness: Awaited<ReturnType<typeof bodyDashboard>>["readiness"];
  promises: Awaited<ReturnType<typeof characterDashboard>>["todayPromises"];
  habits: Awaited<ReturnType<typeof characterDashboard>>["habits"];
  habitsDoneToday: Set<string>;
  businessPriority: Awaited<ReturnType<typeof nextSalesActions>>[number] | null;
  load: Awaited<ReturnType<typeof dayLoad>>;
  backlog: Task[];
}
