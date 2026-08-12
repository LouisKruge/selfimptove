import type { Exercise, Prescription, WorkoutSet } from "@/lib/types";
import { roundToIncrement } from "./stats";

/**
 * PROGRESSIVE OVERLOAD ENGINE
 *
 * Double progression: hold the load until every working set reaches the top of
 * the rep range, then add one increment and drop back to the bottom of the range.
 *
 *   3 × 8–10 @ 90kg   →  10, 9, 8
 *                     →  10, 10, 9
 *                     →  10, 10, 10   (range cleared)
 *                     →  92.5kg × 8–10
 *
 * Hard rule: the engine never invents a target. With no usable history it
 * returns source "NONE" and defers to the template prescription. Everything it
 * does return is a recommendation the user can overwrite.
 */

export type TargetSource = "TEMPLATE" | "PROGRESSION" | "MANUAL" | "NONE";

export interface LastPerformance {
  date: string;
  sets: WorkoutSet[];
}

export interface ProgressionResult {
  weightKg: number | null;
  repMin: number | null;
  repMax: number | null;
  /** Per-set rep targets when holding load, e.g. [10, 10, 9]. */
  perSetReps: number[] | null;
  source: TargetSource;
  rationale: string;
  /** True when the load moved up this session. */
  increased: boolean;
}

type ExerciseRules = Pick<Exercise, "progression_rule" | "increment_kg" | "modality">;

const LOADED_MODALITIES = new Set(["WEIGHT_REPS", "WEIGHTED_BODYWEIGHT"]);

export function computeProgression(
  exercise: ExerciseRules,
  prescription: Pick<Prescription, "target_sets" | "rep_min" | "rep_max" | "target_weight_kg">,
  last: LastPerformance | null,
): ProgressionResult {
  const templateFallback = (rationale: string): ProgressionResult => ({
    weightKg: prescription.target_weight_kg ?? null,
    repMin: prescription.rep_min ?? null,
    repMax: prescription.rep_max ?? null,
    perSetReps: null,
    source: prescription.target_weight_kg !== null || prescription.rep_min !== null ? "TEMPLATE" : "NONE",
    rationale,
    increased: false,
  });

  if (exercise.progression_rule === "NONE") {
    return templateFallback("Progression disabled for this exercise.");
  }

  const working = (last?.sets ?? [])
    .filter((s) => !s.is_warmup && (s.reps ?? 0) > 0)
    .sort((a, b) => a.set_index - b.set_index);

  if (!last || working.length === 0) {
    return templateFallback("No previous performance recorded — using the planned prescription.");
  }

  const repMin = prescription.rep_min;
  const repMax = prescription.rep_max;
  const targetSets = Math.max(1, prescription.target_sets || working.length);
  const isLoaded = LOADED_MODALITIES.has(exercise.modality);

  /* ------------------------------------------------ bodyweight / unloaded */
  if (!isLoaded) {
    const bestReps = Math.max(...working.map((s) => s.reps ?? 0));
    if (repMax !== null && repMin !== null) {
      const cleared =
        working.length >= targetSets && working.every((s) => (s.reps ?? 0) >= repMax);
      if (cleared) {
        return {
          weightKg: prescription.target_weight_kg ?? null,
          repMin,
          repMax: repMax + 2,
          perSetReps: null,
          source: "PROGRESSION",
          rationale: `Cleared ${repMax} on every set — rep range moves to ${repMin}–${repMax + 2}.`,
          increased: true,
        };
      }
      return {
        weightKg: prescription.target_weight_kg ?? null,
        repMin,
        repMax,
        perSetReps: nextRepLadder(working, targetSets, repMax),
        source: "PROGRESSION",
        rationale: `Add one rep where you can. Rep range holds at ${repMin}–${repMax}.`,
        increased: false,
      };
    }
    return {
      weightKg: null,
      repMin: null,
      repMax: null,
      perSetReps: Array.from({ length: targetSets }, () => bestReps + 1),
      source: "PROGRESSION",
      rationale: `Beat last session's best of ${bestReps} reps.`,
      increased: false,
    };
  }

  /* ---------------------------------------------------------- loaded work */
  const weights = working.map((s) => s.weight_kg ?? 0).filter((w) => w > 0);
  if (weights.length === 0) {
    return templateFallback("Last session has no recorded load — using the planned prescription.");
  }

  const topWeight = Math.max(...weights);
  const setsAtTop = working.filter((s) => (s.weight_kg ?? 0) >= topWeight - 0.001);
  const increment = exercise.increment_kg > 0 ? exercise.increment_kg : 2.5;

  if (exercise.progression_rule === "LINEAR") {
    const completedFloor =
      repMin === null || setsAtTop.every((s) => (s.reps ?? 0) >= repMin);
    if (completedFloor && setsAtTop.length >= targetSets) {
      const next = roundToIncrement(topWeight + increment, increment);
      return {
        weightKg: next,
        repMin,
        repMax,
        perSetReps: null,
        source: "PROGRESSION",
        rationale: `Linear progression: ${fmt(topWeight)}kg completed, adding ${fmt(increment)}kg.`,
        increased: true,
      };
    }
    return {
      weightKg: topWeight,
      repMin,
      repMax,
      perSetReps: null,
      source: "PROGRESSION",
      rationale: `Repeat ${fmt(topWeight)}kg — last session did not complete the prescription.`,
      increased: false,
    };
  }

  /* ------------------------------------------------- double progression */
  if (repMin === null || repMax === null) {
    return {
      weightKg: topWeight,
      repMin,
      repMax,
      perSetReps: null,
      source: "PROGRESSION",
      rationale: `Repeat ${fmt(topWeight)}kg — no rep range set, so load is held.`,
      increased: false,
    };
  }

  const clearedRange =
    setsAtTop.length >= targetSets && setsAtTop.every((s) => (s.reps ?? 0) >= repMax);

  if (clearedRange) {
    const next = roundToIncrement(topWeight + increment, increment);
    return {
      weightKg: next,
      repMin,
      repMax,
      perSetReps: null,
      source: "PROGRESSION",
      rationale: `${targetSets} × ${repMax} cleared at ${fmt(topWeight)}kg — load moves to ${fmt(next)}kg.`,
      increased: true,
    };
  }

  const ladder = nextRepLadder(setsAtTop, targetSets, repMax);
  const remaining = ladder.reduce((t, r, i) => {
    const prev = setsAtTop[i]?.reps ?? 0;
    return t + Math.max(0, repMax - prev);
  }, 0);

  return {
    weightKg: topWeight,
    repMin,
    repMax,
    perSetReps: ladder,
    source: "PROGRESSION",
    rationale:
      remaining > 0
        ? `Hold ${fmt(topWeight)}kg — ${remaining} more ${remaining === 1 ? "rep" : "reps"} to clear ${repMax} across all sets.`
        : `Hold ${fmt(topWeight)}kg and complete all ${targetSets} sets.`,
    increased: false,
  };
}

/** Last session's reps + 1, capped at the top of the range. */
function nextRepLadder(
  sets: readonly WorkoutSet[],
  targetSets: number,
  repMax: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < targetSets; i++) {
    const prev = sets[i]?.reps ?? sets[sets.length - 1]?.reps ?? 0;
    out.push(Math.min(repMax, prev + 1));
  }
  return out;
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

/** "92.5kg × 8–10" — the single line shown above the input fields. */
export function formatTarget(p: {
  weightKg?: number | null;
  repMin?: number | null;
  repMax?: number | null;
  targetSeconds?: number | null;
  targetDistanceM?: number | null;
}): string {
  const parts: string[] = [];
  // A zero load is bodyweight work — showing "0kg ×" would be noise.
  if (p.weightKg !== null && p.weightKg !== undefined && p.weightKg > 0) {
    parts.push(`${fmt(p.weightKg)}kg`);
  }
  if (p.targetDistanceM) parts.push(`${p.targetDistanceM}m`);
  const reps =
    p.repMin !== null && p.repMin !== undefined && p.repMax !== null && p.repMax !== undefined
      ? p.repMin === p.repMax
        ? `${p.repMin}`
        : `${p.repMin}–${p.repMax}`
      : null;
  if (reps) parts.push(parts.length ? `× ${reps}` : `${reps} reps`);
  if (p.targetSeconds) parts.push(`${p.targetSeconds}s`);
  return parts.length ? parts.join(" ") : "No target";
}
