import type { Season, ScoredPillar } from "@/lib/types";
import { clamp, round, weightedAverage } from "./stats";

/**
 * PERFORMANCE SCORE
 *
 * Every pillar score is 0–100 and is derived only from rows the user actually
 * logged. A component with no data contributes nothing (it is dropped and the
 * remaining weights renormalise). A pillar with no data at all scores `null`,
 * which the UI renders as "—". COMMAND never fabricates a score.
 */

export interface ScoreComponent {
  key: string;
  label: string;
  weight: number;
  value: number | null;
  detail: string;
}

export interface PillarScore {
  score: number | null;
  components: ScoreComponent[];
}

const nullScore = (components: ScoreComponent[]): PillarScore => ({
  score: null,
  components,
});

function compose(components: ScoreComponent[]): PillarScore {
  const score = weightedAverage(components.map((c) => ({ value: c.value, weight: c.weight })));
  return { score: score === null ? null : round(clamp(score, 0, 100), 1), components };
}

/** Adherence to a target where overshooting is not rewarded but not punished. */
export function attainment(actual: number, target: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) return null;
  return clamp((actual / target) * 100, 0, 100);
}

/** Adherence where both under- and over-shooting cost points (calories, load). */
export function bandAdherence(actual: number, target: number, tolerance = 0.1): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) return null;
  const deviation = Math.abs(actual - target) / target;
  if (deviation <= tolerance) return 100;
  return clamp(100 - (deviation - tolerance) * 250, 0, 100);
}

/* ------------------------------------------------------------------ BODY */

export interface BodyScoreInput {
  plannedSessions: number;
  completedSessions: number;
  skippedSessions: number;
  isRestDay: boolean;
  proteinG: number | null;
  proteinTargetG: number | null;
  calories: number | null;
  calorieTarget: number | null;
  sleepHours: number | null;
  sleepTargetHours: number;
}

export function scoreBody(input: BodyScoreInput): PillarScore {
  const components: ScoreComponent[] = [];

  // Training — a planned rest day that was respected counts as executed.
  let training: number | null = null;
  let trainingDetail = "Nothing planned or logged.";
  if (input.plannedSessions > 0) {
    training = clamp((input.completedSessions / input.plannedSessions) * 100, 0, 100);
    trainingDetail = `${input.completedSessions}/${input.plannedSessions} planned ${
      input.plannedSessions === 1 ? "session" : "sessions"
    } completed.`;
  } else if (input.completedSessions > 0) {
    training = 100;
    trainingDetail = `${input.completedSessions} unplanned ${
      input.completedSessions === 1 ? "session" : "sessions"
    } logged.`;
  } else if (input.isRestDay) {
    training = 100;
    trainingDetail = "Planned recovery day.";
  }
  components.push({
    key: "training",
    label: "Training",
    weight: 45,
    value: training,
    detail: trainingDetail,
  });

  const protein =
    input.proteinG !== null && input.proteinTargetG
      ? attainment(input.proteinG, input.proteinTargetG)
      : null;
  components.push({
    key: "protein",
    label: "Protein",
    weight: 22,
    value: protein,
    detail:
      protein === null
        ? "No protein logged."
        : `${Math.round(input.proteinG ?? 0)}g of ${input.proteinTargetG}g.`,
  });

  const calories =
    input.calories !== null && input.calorieTarget
      ? bandAdherence(input.calories, input.calorieTarget, 0.08)
      : null;
  components.push({
    key: "calories",
    label: "Calories",
    weight: 13,
    value: calories,
    detail:
      calories === null
        ? "No intake logged."
        : `${Math.round(input.calories ?? 0)} of ${input.calorieTarget} kcal.`,
  });

  const sleep =
    input.sleepHours !== null ? attainment(input.sleepHours, input.sleepTargetHours) : null;
  components.push({
    key: "sleep",
    label: "Sleep",
    weight: 20,
    value: sleep,
    detail:
      sleep === null
        ? "No sleep logged."
        : `${input.sleepHours}h of ${input.sleepTargetHours}h target.`,
  });

  return compose(components);
}

/* -------------------------------------------------------------- BUSINESS */

export interface BusinessScoreInput {
  mustWinScheduled: number;
  mustWinComplete: number;
  supportScheduled: number;
  supportComplete: number;
  pipelineTouchesToday: number;
  openLeads: number;
  revenueTodayCents: number;
  deepWorkMinutes: number | null;
}

export function scoreBusiness(input: BusinessScoreInput): PillarScore {
  const components: ScoreComponent[] = [];

  const mustWin =
    input.mustWinScheduled > 0
      ? clamp((input.mustWinComplete / input.mustWinScheduled) * 100, 0, 100)
      : null;
  components.push({
    key: "must_win",
    label: "Must-win",
    weight: 45,
    value: mustWin,
    detail:
      mustWin === null
        ? "No must-win task set."
        : `${input.mustWinComplete}/${input.mustWinScheduled} must-win complete.`,
  });

  const support =
    input.supportScheduled > 0
      ? clamp((input.supportComplete / input.supportScheduled) * 100, 0, 100)
      : null;
  components.push({
    key: "support",
    label: "Support tasks",
    weight: 20,
    value: support,
    detail:
      support === null
        ? "No support tasks scheduled."
        : `${input.supportComplete}/${input.supportScheduled} support tasks complete.`,
  });

  // Pipeline activity only counts once there is a pipeline to work.
  const pipeline =
    input.openLeads > 0 ? clamp(input.pipelineTouchesToday * 50, 0, 100) : null;
  components.push({
    key: "pipeline",
    label: "Pipeline activity",
    weight: 25,
    value: pipeline,
    detail:
      pipeline === null
        ? "No open leads to work."
        : `${input.pipelineTouchesToday} pipeline ${
            input.pipelineTouchesToday === 1 ? "movement" : "movements"
          } today.`,
  });

  const revenue = input.revenueTodayCents > 0 ? 100 : null;
  components.push({
    key: "revenue",
    label: "Revenue",
    weight: 10,
    value: revenue,
    detail: revenue === null ? "No revenue recorded today." : "Revenue recorded today.",
  });

  return compose(components);
}

/* ------------------------------------------------------------- CHARACTER */

export interface CharacterScoreInput {
  promisesKept: number;
  promisesBroken: number;
  promisesOpen: number;
  habitsDue: number;
  habitsDone: number;
  reviewCompleted: boolean | null;
}

export function scoreCharacter(input: CharacterScoreInput): PillarScore {
  const components: ScoreComponent[] = [];
  const resolved = input.promisesKept + input.promisesBroken;

  const promises = resolved > 0 ? (input.promisesKept / resolved) * 100 : null;
  components.push({
    key: "promises",
    label: "Promises",
    weight: 45,
    value: promises,
    detail:
      promises === null
        ? input.promisesOpen > 0
          ? `${input.promisesOpen} still open.`
          : "No promises made."
        : `${input.promisesKept}/${resolved} kept.`,
  });

  const habits =
    input.habitsDue > 0 ? clamp((input.habitsDone / input.habitsDue) * 100, 0, 100) : null;
  components.push({
    key: "habits",
    label: "Habits",
    weight: 40,
    value: habits,
    detail:
      habits === null ? "No active habits." : `${input.habitsDone}/${input.habitsDue} done.`,
  });

  const review = input.reviewCompleted === null ? null : input.reviewCompleted ? 100 : 0;
  components.push({
    key: "reflection",
    label: "Reflection",
    weight: 15,
    value: review,
    detail:
      review === null
        ? "No review due."
        : input.reviewCompleted
          ? "Review completed."
          : "Review outstanding.",
  });

  return compose(components);
}

/* --------------------------------------------------------------- FINANCE */

export interface FinanceScoreInput {
  /** Lowest projected cash balance over the next 30 days, in cents. */
  projectedLowCents: number | null;
  /** Target buffer the low point should stay above, in cents. */
  bufferTargetCents: number;
  /** Debt balance now vs 30 days ago, in cents. */
  debtNowCents: number | null;
  debtPriorCents: number | null;
  /** Trailing 30-day income and spend, in cents. */
  incomeCents: number | null;
  expensesCents: number | null;
  savingsRateTarget: number;
}

export function scoreFinance(input: FinanceScoreInput): PillarScore {
  const components: ScoreComponent[] = [];

  let runway: number | null = null;
  let runwayDetail = "No cash or scheduled items recorded.";
  if (input.projectedLowCents !== null) {
    if (input.projectedLowCents < 0) {
      runway = 0;
      runwayDetail = "Projected shortfall within 30 days.";
    } else if (input.bufferTargetCents > 0) {
      runway = clamp((input.projectedLowCents / input.bufferTargetCents) * 100, 0, 100);
      runwayDetail = "Projected 30-day low against buffer target.";
    } else {
      runway = 100;
      runwayDetail = "Projected cash stays positive.";
    }
  }
  components.push({
    key: "runway",
    label: "Cash safety",
    weight: 45,
    value: runway,
    detail: runwayDetail,
  });

  let debt: number | null = null;
  let debtDetail = "No debt tracked.";
  if (input.debtNowCents !== null && input.debtPriorCents !== null) {
    if (input.debtPriorCents === 0) {
      debt = input.debtNowCents === 0 ? 100 : 0;
      debtDetail = input.debtNowCents === 0 ? "Debt free." : "New debt taken on.";
    } else {
      const reduction = (input.debtPriorCents - input.debtNowCents) / input.debtPriorCents;
      // 3% reduction across 30 days scores full marks.
      debt = clamp((reduction / 0.03) * 100, 0, 100);
      debtDetail = `Debt ${reduction >= 0 ? "down" : "up"} ${Math.abs(reduction * 100).toFixed(1)}% over 30 days.`;
    }
  }
  components.push({ key: "debt", label: "Debt", weight: 30, value: debt, detail: debtDetail });

  let savings: number | null = null;
  let savingsDetail = "No income recorded in the last 30 days.";
  if (input.incomeCents !== null && input.incomeCents > 0 && input.expensesCents !== null) {
    const rate = (input.incomeCents - input.expensesCents) / input.incomeCents;
    savings = clamp((rate / Math.max(0.01, input.savingsRateTarget)) * 100, 0, 100);
    savingsDetail = `Saving ${(rate * 100).toFixed(0)}% of income (target ${(input.savingsRateTarget * 100).toFixed(0)}%).`;
  }
  components.push({
    key: "savings",
    label: "Savings rate",
    weight: 25,
    value: savings,
    detail: savingsDetail,
  });

  return compose(components);
}

/* -------------------------------------------------------------- LEARNING */

export interface LearningScoreInput {
  /** Days in the trailing 7 with any learning logged. */
  activeDays7: number;
  targetDaysPerWeek: number;
  minutes7: number;
  targetMinutesPerWeek: number;
  /** Applied vs total learning items in the trailing 30 days. */
  applied30: number;
  total30: number;
}

export function scoreLearning(input: LearningScoreInput): PillarScore {
  const components: ScoreComponent[] = [];

  const consistency =
    input.targetDaysPerWeek > 0
      ? clamp((input.activeDays7 / input.targetDaysPerWeek) * 100, 0, 100)
      : null;
  components.push({
    key: "consistency",
    label: "Consistency",
    weight: 40,
    value: consistency,
    detail: `${input.activeDays7} of ${input.targetDaysPerWeek} target days in the last 7.`,
  });

  const volume =
    input.targetMinutesPerWeek > 0
      ? clamp((input.minutes7 / input.targetMinutesPerWeek) * 100, 0, 100)
      : null;
  components.push({
    key: "volume",
    label: "Hours",
    weight: 25,
    value: volume,
    detail: `${Math.round(input.minutes7 / 6) / 10}h of ${Math.round(input.targetMinutesPerWeek / 60)}h target.`,
  });

  // Capability, not consumption: what fraction of study became application.
  const application = input.total30 > 0 ? (input.applied30 / input.total30) * 100 : null;
  components.push({
    key: "application",
    label: "Application",
    weight: 35,
    value: application,
    detail:
      application === null
        ? "Nothing studied in the last 30 days."
        : `${input.applied30}/${input.total30} items applied.`,
  });

  return compose(components);
}

/* ---------------------------------------------------------------- OVERALL */

export type PillarWeights = Record<ScoredPillar, number>;

export const DEFAULT_WEIGHTS: PillarWeights = {
  BODY: 25,
  BUSINESS: 30,
  CHARACTER: 25,
  FINANCE: 10,
  LEARNING: 10,
};

export function weightsFromSeason(season: Season | null | undefined): PillarWeights {
  if (!season) return DEFAULT_WEIGHTS;
  return {
    BODY: season.weight_body,
    BUSINESS: season.weight_business,
    CHARACTER: season.weight_character,
    FINANCE: season.weight_finance,
    LEARNING: season.weight_learning,
  };
}

export function overallScore(
  scores: Partial<Record<ScoredPillar, number | null>>,
  weights: PillarWeights = DEFAULT_WEIGHTS,
): number | null {
  const parts = (Object.keys(weights) as ScoredPillar[]).map((p) => ({
    value: scores[p] ?? null,
    weight: weights[p],
  }));
  const v = weightedAverage(parts);
  return v === null ? null : round(v, 1);
}

/** Verdict band for a 0–100 score. Used for copy, never for colour alone. */
export function scoreBand(score: number | null): "NONE" | "CRITICAL" | "LOW" | "SOLID" | "STRONG" {
  if (score === null) return "NONE";
  if (score < 40) return "CRITICAL";
  if (score < 65) return "LOW";
  if (score < 85) return "SOLID";
  return "STRONG";
}

export { nullScore };
