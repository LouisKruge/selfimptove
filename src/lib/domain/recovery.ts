import { clamp, mean, round } from "./stats";

/**
 * RECOVERY ENGINE
 *
 * A readiness indicator built only from what the user logged: sleep, energy,
 * stress, soreness and recent session RPE. It is a summary of self-reported
 * inputs — not a diagnosis, not medical advice, and it never names a condition.
 */

export type Readiness = "LOW" | "MODERATE" | "HIGH";

export interface ReadinessInput {
  sleepHours: number | null;
  sleepQuality: number | null; // 1–5
  energy: number | null; // 1–5
  stress: number | null; // 1–5, higher is worse
  soreness: number | null; // 1–5, higher is worse
  /** Mean session RPE over the last 3 training days. */
  recentSessionRpe: number | null;
  /** Consecutive training days immediately before today. */
  consecutiveTrainingDays: number;
}

export interface ReadinessResult {
  level: Readiness | null;
  index: number | null; // 0–100
  drivers: Array<{ label: string; value: number; note: string }>;
  message: string;
}

export function assessReadiness(input: ReadinessInput): ReadinessResult {
  const drivers: Array<{ label: string; value: number; note: string }> = [];

  if (input.sleepHours !== null) {
    const v = clamp((input.sleepHours / 8) * 100, 0, 100);
    drivers.push({ label: "Sleep duration", value: v, note: `${input.sleepHours}h logged.` });
  }
  if (input.sleepQuality !== null) {
    drivers.push({
      label: "Sleep quality",
      value: ((input.sleepQuality - 1) / 4) * 100,
      note: `${input.sleepQuality}/5.`,
    });
  }
  if (input.energy !== null) {
    drivers.push({
      label: "Energy",
      value: ((input.energy - 1) / 4) * 100,
      note: `${input.energy}/5.`,
    });
  }
  if (input.stress !== null) {
    drivers.push({
      label: "Stress",
      value: ((5 - input.stress) / 4) * 100,
      note: `${input.stress}/5 reported.`,
    });
  }
  if (input.soreness !== null) {
    drivers.push({
      label: "Soreness",
      value: ((5 - input.soreness) / 4) * 100,
      note: `${input.soreness}/5 reported.`,
    });
  }
  if (input.recentSessionRpe !== null) {
    drivers.push({
      label: "Recent session load",
      value: clamp(100 - (input.recentSessionRpe - 5) * 20, 0, 100),
      note: `Average RPE ${input.recentSessionRpe} over recent sessions.`,
    });
  }
  if (input.consecutiveTrainingDays >= 3) {
    drivers.push({
      label: "Consecutive training days",
      value: clamp(100 - (input.consecutiveTrainingDays - 2) * 25, 0, 100),
      note: `${input.consecutiveTrainingDays} in a row.`,
    });
  }

  if (drivers.length < 2) {
    return {
      level: null,
      index: null,
      drivers,
      message:
        "Log sleep and how you feel to get a readiness reading. Fewer than two inputs is not enough to summarise.",
    };
  }

  const index = round(mean(drivers.map((d) => d.value)) ?? 0, 0);
  const level: Readiness = index >= 70 ? "HIGH" : index >= 45 ? "MODERATE" : "LOW";

  const weakest = [...drivers].sort((a, b) => a.value - b.value)[0];
  const message =
    level === "HIGH"
      ? "Inputs are strong across the board. Train as planned."
      : level === "MODERATE"
        ? `Mixed inputs — ${weakest.label.toLowerCase()} is the weakest signal. Train, but hold the top end.`
        : `Inputs are low, driven mainly by ${weakest.label.toLowerCase()}. Consider reducing volume or taking the planned recovery day.`;

  return { level, index, drivers, message };
}
