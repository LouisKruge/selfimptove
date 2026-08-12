import { mean, round } from "./stats";

/**
 * TRAINING LOAD
 *
 * Acute (7-day) versus chronic (28-day) workload. Reports substantial changes
 * in workload compared with recent history. It describes the numbers only —
 * it does not diagnose injury risk or any medical condition.
 */

export interface LoadPoint {
  date: string;
  /** duration × session RPE, the standard session-load unit. */
  load: number;
}

export interface LoadAnalysis {
  acute: number | null;
  chronic: number | null;
  ratio: number | null;
  weekOverWeekPct: number | null;
  status: "NO_DATA" | "BUILDING" | "STEADY" | "SHARP_INCREASE" | "SHARP_DROP";
  message: string;
}

const MIN_CHRONIC_DAYS = 14;

export function analyseLoad(points: readonly LoadPoint[], today: string): LoadAnalysis {
  const in7 = points.filter((p) => daysAgo(p.date, today) < 7);
  const in28 = points.filter((p) => daysAgo(p.date, today) < 28);
  const prior7 = points.filter((p) => {
    const d = daysAgo(p.date, today);
    return d >= 7 && d < 14;
  });

  const acute = in7.length ? round(in7.reduce((t, p) => t + p.load, 0), 0) : null;
  const priorAcute = prior7.length ? prior7.reduce((t, p) => t + p.load, 0) : null;

  const distinctDays = new Set(in28.map((p) => p.date)).size;
  const chronic =
    in28.length && distinctDays >= MIN_CHRONIC_DAYS
      ? round((in28.reduce((t, p) => t + p.load, 0) / 28) * 7, 0)
      : null;

  if (acute === null && chronic === null) {
    return {
      acute: null,
      chronic: null,
      ratio: null,
      weekOverWeekPct: null,
      status: "NO_DATA",
      message: "No session load logged. Record duration and session RPE to track workload.",
    };
  }

  const ratio = acute !== null && chronic !== null && chronic > 0 ? round(acute / chronic, 2) : null;
  const wow =
    acute !== null && priorAcute !== null && priorAcute > 0
      ? round(((acute - priorAcute) / priorAcute) * 100, 0)
      : null;

  let status: LoadAnalysis["status"] = "STEADY";
  let message = "Workload is consistent with recent weeks.";

  if (chronic === null) {
    status = "BUILDING";
    message = `Building a baseline — ${distinctDays} of ${MIN_CHRONIC_DAYS} days needed before workload can be compared to history.`;
  } else if (ratio !== null && ratio > 1.5) {
    status = "SHARP_INCREASE";
    message = `This week's load is ${Math.round(ratio * 100)}% of your 4-week average. That is a substantial jump.`;
  } else if (ratio !== null && ratio < 0.6) {
    status = "SHARP_DROP";
    message = `This week's load is ${Math.round(ratio * 100)}% of your 4-week average. Volume has dropped sharply.`;
  } else if (wow !== null && Math.abs(wow) >= 40) {
    status = wow > 0 ? "SHARP_INCREASE" : "SHARP_DROP";
    message = `Load changed ${wow > 0 ? "+" : "−"}${Math.abs(wow)}% versus last week.`;
  }

  return { acute, chronic, ratio, weekOverWeekPct: wow, status, message };
}

/** Session load = minutes × session RPE. Null when either input is missing. */
export function sessionLoad(minutes: number | null, rpe: number | null): number | null {
  if (minutes === null || rpe === null) return null;
  if (minutes <= 0 || rpe <= 0) return null;
  return round(minutes * rpe, 0);
}

export interface VolumeByGroup {
  group: string;
  sets: number;
  volumeKg: number;
}

/** Weekly sets and tonnage per muscle group. */
export function volumeByMuscleGroup(
  rows: ReadonlyArray<{ muscle_group: string | null; weight_kg: number | null; reps: number | null }>,
): VolumeByGroup[] {
  const map = new Map<string, VolumeByGroup>();
  for (const r of rows) {
    const group = r.muscle_group ?? "OTHER";
    const entry = map.get(group) ?? { group, sets: 0, volumeKg: 0 };
    entry.sets += 1;
    entry.volumeKg += (r.weight_kg ?? 0) * (r.reps ?? 0);
    map.set(group, entry);
  }
  return [...map.values()]
    .map((v) => ({ ...v, volumeKg: round(v.volumeKg, 0) }))
    .sort((a, b) => b.sets - a.sets);
}

export function averageOrNull(values: ReadonlyArray<number | null>): number | null {
  const v = values.filter((x): x is number => x !== null);
  const m = mean(v);
  return m === null ? null : round(m, 1);
}

function daysAgo(date: string, today: string): number {
  const a = Date.parse(`${today}T12:00:00Z`);
  const b = Date.parse(`${date}T12:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}
