import type { Trend } from "@/lib/types";
import { mean, slope, round } from "./stats";

/**
 * TRAJECTORY ENGINE
 *
 * Direction is derived from the actual score series, never asserted. With too
 * few data points the answer is "insufficient data", not "flat" — a flat arrow
 * is a claim, and COMMAND does not make claims it cannot support.
 */

export interface TrajectoryResult {
  trend: Trend | null;
  /** Points per day of change across the window. */
  slope: number | null;
  recentAverage: number | null;
  priorAverage: number | null;
  delta: number | null;
  sampleSize: number;
  detail: string;
}

/** Below this daily slope the series is treated as holding, not moving. */
const FLAT_THRESHOLD = 0.15;
const MIN_POINTS = 4;

export function trajectory(series: ReadonlyArray<number | null>): TrajectoryResult {
  const values = series.filter((v): v is number => v !== null && Number.isFinite(v));

  if (values.length < MIN_POINTS) {
    return {
      trend: null,
      slope: null,
      recentAverage: mean(values),
      priorAverage: null,
      delta: null,
      sampleSize: values.length,
      detail: `Needs ${MIN_POINTS} scored days — ${values.length} recorded.`,
    };
  }

  const s = slope(values);
  const half = Math.floor(values.length / 2);
  const prior = mean(values.slice(0, half));
  const recent = mean(values.slice(half));
  const delta = prior !== null && recent !== null ? round(recent - prior, 1) : null;

  let trend: Trend = "FLAT";
  if (s !== null && s > FLAT_THRESHOLD) trend = "UP";
  else if (s !== null && s < -FLAT_THRESHOLD) trend = "DOWN";

  const detail =
    delta === null
      ? `${values.length} scored days.`
      : `${delta >= 0 ? "+" : "−"}${Math.abs(delta)} vs the first half of the window (${values.length} days).`;

  return {
    trend,
    slope: s === null ? null : round(s, 3),
    recentAverage: recent === null ? null : round(recent, 1),
    priorAverage: prior === null ? null : round(prior, 1),
    delta,
    sampleSize: values.length,
    detail,
  };
}

export const TREND_GLYPH: Record<Trend, string> = {
  UP: "↑",
  FLAT: "→",
  DOWN: "↓",
};

export function trendGlyph(trend: Trend | null): string {
  return trend === null ? "·" : TREND_GLYPH[trend];
}

export function trendWord(trend: Trend | null): string {
  if (trend === null) return "NO DATA";
  return trend === "UP" ? "UP" : trend === "DOWN" ? "DOWN" : "FLAT";
}

/**
 * Direction of a raw metric series (weight, revenue, debt…), where "good" may
 * be down. Returns the trend of the number itself; interpretation is the
 * caller's job.
 */
export function metricTrajectory(
  series: ReadonlyArray<number | null>,
  flatThresholdPct = 1,
): TrajectoryResult {
  const values = series.filter((v): v is number => v !== null && Number.isFinite(v));
  if (values.length < 3) {
    return {
      trend: null,
      slope: null,
      recentAverage: mean(values),
      priorAverage: null,
      delta: null,
      sampleSize: values.length,
      detail: `Needs 3 data points — ${values.length} recorded.`,
    };
  }
  const half = Math.floor(values.length / 2);
  const prior = mean(values.slice(0, half))!;
  const recent = mean(values.slice(half))!;
  const delta = recent - prior;

  // With a zero baseline a percentage is meaningless — report the movement
  // itself rather than inventing "+100%".
  if (prior === 0) {
    return {
      trend: delta > 0 ? "UP" : delta < 0 ? "DOWN" : "FLAT",
      slope: slope(values),
      recentAverage: round(recent, 2),
      priorAverage: 0,
      delta: round(delta, 2),
      sampleSize: values.length,
      detail:
        delta === 0
          ? "Flat from a zero baseline."
          : `Moved from nothing to ${round(recent, 2)} across the window.`,
    };
  }

  const relative = (delta / Math.abs(prior)) * 100;

  let trend: Trend = "FLAT";
  if (relative > flatThresholdPct) trend = "UP";
  else if (relative < -flatThresholdPct) trend = "DOWN";

  return {
    trend,
    slope: slope(values),
    recentAverage: round(recent, 2),
    priorAverage: round(prior, 2),
    delta: round(delta, 2),
    sampleSize: values.length,
    detail: `${relative >= 0 ? "+" : "−"}${Math.abs(relative).toFixed(1)}% across the window.`,
  };
}
