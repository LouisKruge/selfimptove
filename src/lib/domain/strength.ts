import type { WorkoutSet } from "@/lib/types";
import { max, round } from "./stats";

/** Epley estimate. Only meaningful for 1–12 reps; above that it is not used. */
export function estimate1RM(weightKg: number, reps: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return null;
  if (weightKg <= 0 || reps <= 0 || reps > 12) return null;
  return round(weightKg * (1 + reps / 30), 1);
}

export function setVolume(s: Pick<WorkoutSet, "weight_kg" | "reps">): number {
  const w = s.weight_kg ?? 0;
  const r = s.reps ?? 0;
  return w * r;
}

export interface SessionExerciseSummary {
  sets: WorkoutSet[];
  workingSets: WorkoutSet[];
  totalReps: number;
  volumeKg: number;
  topWeightKg: number | null;
  bestE1RM: number | null;
  avgRpe: number | null;
}

export function summariseSets(sets: readonly WorkoutSet[]): SessionExerciseSummary {
  const all = [...sets];
  const working = all.filter((s) => !s.is_warmup);
  const rpes = working.map((s) => s.rpe).filter((v): v is number => v !== null);
  const e1rms = working
    .map((s) => (s.weight_kg && s.reps ? estimate1RM(s.weight_kg, s.reps) : null))
    .filter((v): v is number => v !== null);

  return {
    sets: all,
    workingSets: working,
    totalReps: working.reduce((t, s) => t + (s.reps ?? 0), 0),
    volumeKg: round(working.reduce((t, s) => t + setVolume(s), 0), 1),
    topWeightKg: max(working.map((s) => s.weight_kg ?? 0).filter((v) => v > 0)),
    bestE1RM: max(e1rms),
    avgRpe: rpes.length ? round(rpes.reduce((a, b) => a + b, 0) / rpes.length, 1) : null,
  };
}

/** "90kg × 10" or "10 reps" for bodyweight work. */
export function formatSet(s: Pick<WorkoutSet, "weight_kg" | "reps" | "seconds" | "distance_m">): string {
  if (s.weight_kg && s.reps) {
    const w = Number.isInteger(s.weight_kg) ? s.weight_kg : round(s.weight_kg, 2);
    return `${w}kg × ${s.reps}`;
  }
  if (s.reps && s.seconds) return `${s.reps} × ${s.seconds}s`;
  if (s.reps) return `${s.reps} reps`;
  if (s.distance_m && s.seconds) return `${s.distance_m}m / ${s.seconds}s`;
  if (s.seconds) return `${s.seconds}s`;
  if (s.distance_m) return `${s.distance_m}m`;
  return "—";
}

/** Groups an exercise's set history into sessions, newest first. */
export function groupSetsBySession(sets: readonly WorkoutSet[]): Array<{
  sessionId: string;
  date: string;
  sets: WorkoutSet[];
  summary: SessionExerciseSummary;
}> {
  const map = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const list = map.get(s.session_id);
    if (list) list.push(s);
    else map.set(s.session_id, [s]);
  }
  return [...map.entries()]
    .map(([sessionId, group]) => {
      const ordered = [...group].sort((a, b) => a.set_index - b.set_index);
      return {
        sessionId,
        date: ordered[0].date,
        sets: ordered,
        summary: summariseSets(ordered),
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
