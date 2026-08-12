import { mean, round, slope } from "./stats";

/**
 * NUTRITION TREND ENGINE
 *
 * Compares logged intake against the actual bodyweight trend and reports
 * whether the two agree. Descriptive only — no medical claims, no prescriptions.
 */

export interface NutritionTrendInput {
  /** Daily calorie totals over the window, in log order. Nulls = unlogged days. */
  calories: ReadonlyArray<number | null>;
  proteinG: ReadonlyArray<number | null>;
  /** Bodyweight readings over the same window, in kg. Nulls = no weigh-in. */
  weightKg: ReadonlyArray<number | null>;
  calorieTarget: number;
  proteinTarget: number;
  /** Intended weekly weight change in kg, e.g. +0.25 for a lean gain. */
  intendedWeeklyKg: number | null;
  windowDays: number;
}

export interface NutritionTrendResult {
  loggedDays: number;
  loggingRate: number;
  avgCalories: number | null;
  avgProtein: number | null;
  calorieGap: number | null;
  proteinGap: number | null;
  observedWeeklyKg: number | null;
  intendedWeeklyKg: number | null;
  verdict:
    | "ON_TRACK"
    | "OFF_TREND"
    | "INTAKE_BELOW_TARGET"
    | "INTAKE_ABOVE_TARGET"
    | "INSUFFICIENT_DATA";
  message: string;
}

const MIN_LOGGED_DAYS = 7;
const MIN_WEIGHTS = 4;

export function analyseNutritionTrend(input: NutritionTrendInput): NutritionTrendResult {
  const cals = input.calories.filter((v): v is number => v !== null);
  const prots = input.proteinG.filter((v): v is number => v !== null);
  const weights = input.weightKg.filter((v): v is number => v !== null);

  const avgCalories = mean(cals);
  const avgProtein = mean(prots);
  const loggingRate = input.windowDays > 0 ? round((cals.length / input.windowDays) * 100, 0) : 0;

  const base: Omit<NutritionTrendResult, "verdict" | "message"> = {
    loggedDays: cals.length,
    loggingRate,
    avgCalories: avgCalories === null ? null : round(avgCalories, 0),
    avgProtein: avgProtein === null ? null : round(avgProtein, 0),
    calorieGap: avgCalories === null ? null : round(avgCalories - input.calorieTarget, 0),
    proteinGap: avgProtein === null ? null : round(avgProtein - input.proteinTarget, 0),
    observedWeeklyKg: null,
    intendedWeeklyKg: input.intendedWeeklyKg,
  };

  if (cals.length < MIN_LOGGED_DAYS) {
    return {
      ...base,
      verdict: "INSUFFICIENT_DATA",
      message: `Only ${cals.length} of the last ${input.windowDays} days have intake logged. At least ${MIN_LOGGED_DAYS} are needed before a trend means anything.`,
    };
  }

  // Weight trend per week from the least-squares slope of the weigh-ins.
  let observedWeeklyKg: number | null = null;
  if (weights.length >= MIN_WEIGHTS) {
    const perReading = slope(weights);
    if (perReading !== null) {
      // Readings are spread across the window; convert to a per-week figure.
      const readingsPerDay = weights.length / input.windowDays;
      if (readingsPerDay > 0) {
        observedWeeklyKg = round(perReading * readingsPerDay * 7, 2);
      }
    }
  }
  base.observedWeeklyKg = observedWeeklyKg;

  const calorieGap = base.calorieGap ?? 0;
  const calorieOff = Math.abs(calorieGap) > input.calorieTarget * 0.08;

  if (observedWeeklyKg === null) {
    if (calorieOff) {
      return {
        ...base,
        verdict: calorieGap < 0 ? "INTAKE_BELOW_TARGET" : "INTAKE_ABOVE_TARGET",
        message: `Averaging ${Math.round(base.avgCalories ?? 0)} kcal against a ${input.calorieTarget} target. Not enough weigh-ins to say what that is producing — log weight at least ${MIN_WEIGHTS} times per window.`,
      };
    }
    return {
      ...base,
      verdict: "INSUFFICIENT_DATA",
      message: `Intake is on target, but there are only ${weights.length} weigh-ins. Log weight more often to see what the intake is producing.`,
    };
  }

  if (input.intendedWeeklyKg === null) {
    return {
      ...base,
      verdict: calorieOff
        ? calorieGap < 0
          ? "INTAKE_BELOW_TARGET"
          : "INTAKE_ABOVE_TARGET"
        : "ON_TRACK",
      message: `Weight is moving ${signKg(observedWeeklyKg)}/week on ${Math.round(base.avgCalories ?? 0)} kcal. Set an intended trend on your nutrition target to have this checked automatically.`,
    };
  }

  const drift = observedWeeklyKg - input.intendedWeeklyKg;
  const tolerance = Math.max(0.12, Math.abs(input.intendedWeeklyKg) * 0.5);

  if (Math.abs(drift) <= tolerance) {
    return {
      ...base,
      verdict: "ON_TRACK",
      message: `Weight is moving ${signKg(observedWeeklyKg)}/week against an intended ${signKg(input.intendedWeeklyKg)}/week. Current intake is producing the intended trend.`,
    };
  }

  return {
    ...base,
    verdict: "OFF_TREND",
    message: `Current intake may not be producing the intended weight trend: ${signKg(
      observedWeeklyKg,
    )}/week observed against ${signKg(input.intendedWeeklyKg)}/week intended, on an average of ${Math.round(
      base.avgCalories ?? 0,
    )} kcal.`,
  };
}

function signKg(v: number): string {
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}kg`;
}

/** Remaining macro targets for the day. Negative means over. */
export function remaining(
  consumed: { calories: number; protein_g: number; carbs_g: number; fat_g: number },
  target: { calories: number; protein_g: number; carbs_g: number; fat_g: number },
) {
  return {
    calories: target.calories - consumed.calories,
    protein_g: round(target.protein_g - consumed.protein_g, 1),
    carbs_g: round(target.carbs_g - consumed.carbs_g, 1),
    fat_g: round(target.fat_g - consumed.fat_g, 1),
  };
}
