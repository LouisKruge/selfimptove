import type { RunInterval } from "@/lib/types";
import { mean, round, stdev, sum } from "./stats";

/** RUNNING ENGINE — pace maths and interval-session analysis. */

/** Seconds per kilometre. Null when either input is missing or zero. */
export function paceSecPerKm(distanceM: number | null, durationSec: number | null): number | null {
  if (!distanceM || !durationSec || distanceM <= 0 || durationSec <= 0) return null;
  return Math.round(durationSec / (distanceM / 1000));
}

export function projectedTime(distanceM: number, paceSec: number): number {
  return Math.round((distanceM / 1000) * paceSec);
}

export interface IntervalAnalysis {
  count: number;
  totalDistanceM: number;
  totalWorkSec: number;
  averagePaceSec: number | null;
  targetPaceSec: number | null;
  /** Average seconds per km faster (negative) or slower (positive) than target. */
  differenceSec: number | null;
  bestIndex: number | null;
  worstIndex: number | null;
  bestPaceSec: number | null;
  worstPaceSec: number | null;
  /** 100 = identical splits. Null under 3 intervals. */
  consistency: number | null;
  onTargetCount: number;
  verdict: string;
}

export function analyseIntervals(intervals: readonly RunInterval[]): IntervalAnalysis {
  const withPace = intervals
    .map((i) => ({
      ...i,
      pace: i.pace_sec ?? paceSecPerKm(i.distance_m, i.duration_sec),
    }))
    .filter((i): i is RunInterval & { pace: number } => i.pace !== null && i.pace > 0);

  const totalDistanceM = sum(intervals.map((i) => i.distance_m ?? 0));
  const totalWorkSec = sum(intervals.map((i) => i.duration_sec ?? 0));

  if (withPace.length === 0) {
    return {
      count: intervals.length,
      totalDistanceM,
      totalWorkSec,
      averagePaceSec: null,
      targetPaceSec: null,
      differenceSec: null,
      bestIndex: null,
      worstIndex: null,
      bestPaceSec: null,
      worstPaceSec: null,
      consistency: null,
      onTargetCount: 0,
      verdict: "No completed intervals recorded.",
    };
  }

  const paces = withPace.map((i) => i.pace);
  const avg = round(mean(paces) ?? 0, 0);

  const targets = withPace
    .map((i) => i.target_pace_sec)
    .filter((v): v is number => v !== null && v > 0);
  const targetPace = targets.length ? round(mean(targets) ?? 0, 0) : null;

  const sorted = [...withPace].sort((a, b) => a.pace - b.pace);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const sd = paces.length >= 3 ? stdev(paces) : null;
  const consistency = sd !== null && avg > 0 ? round(100 - (sd / avg) * 100, 1) : null;

  const onTarget = withPace.filter(
    (i) => i.target_pace_sec !== null && i.pace <= i.target_pace_sec,
  ).length;

  const difference = targetPace !== null ? avg - targetPace : null;

  let verdict: string;
  if (difference === null) {
    verdict = `${withPace.length} intervals averaging ${fmtPace(avg)}. No target pace was set.`;
  } else if (difference <= 0) {
    verdict = `${onTarget}/${withPace.length} intervals at or under target. Average ${Math.abs(difference)}s/km faster than prescribed.`;
  } else {
    verdict = `${onTarget}/${withPace.length} intervals at or under target. Average ${difference}s/km slower than prescribed.`;
  }

  return {
    count: withPace.length,
    totalDistanceM,
    totalWorkSec,
    averagePaceSec: avg,
    targetPaceSec: targetPace,
    differenceSec: difference,
    bestIndex: best.interval_index,
    worstIndex: worst.interval_index,
    bestPaceSec: best.pace,
    worstPaceSec: worst.pace,
    consistency,
    onTargetCount: onTarget,
    verdict,
  };
}

function fmtPace(secPerKm: number): string {
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, "0")}/km`;
}

export interface MileageWeek {
  weekStart: string;
  distanceM: number;
  durationSec: number;
  runs: number;
}

export function weeklyMileage(
  runs: ReadonlyArray<{ date: string; distance_m: number | null; duration_sec: number | null }>,
  startOfWeek: (d: string) => string,
): MileageWeek[] {
  const map = new Map<string, MileageWeek>();
  for (const r of runs) {
    const key = startOfWeek(r.date);
    const w = map.get(key) ?? { weekStart: key, distanceM: 0, durationSec: 0, runs: 0 };
    w.distanceM += r.distance_m ?? 0;
    w.durationSec += r.duration_sec ?? 0;
    w.runs += 1;
    map.set(key, w);
  }
  return [...map.values()].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}
