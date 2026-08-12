import "server-only";

import { all, get } from "@/lib/db";
import { insert } from "@/lib/db/repo";
import { estimate1RM } from "@/lib/domain/strength";
import { round } from "@/lib/domain/stats";
import { paceSecPerKm } from "@/lib/domain/running";
import type { DayString } from "@/lib/core/date";
import type { HyroxStationName, PersonalRecord, WorkoutSet } from "@/lib/types";

/**
 * PERSONAL RECORD ENGINE
 *
 * A record is only recorded when the new value actually beats every value
 * previously logged for that exercise and kind. Prior bests come from the raw
 * set history, so records stay correct even if rows are edited or deleted.
 */

type StrengthKind = "WEIGHT" | "REPS" | "VOLUME" | "E1RM";

export interface DetectedRecord {
  kind: PersonalRecord["kind"];
  value: number;
  previous: number | null;
  display: string;
}

export function detectStrengthRecords(
  exerciseId: string,
  sessionId: string,
  date: DayString,
): DetectedRecord[] {
  const sessionSets = all<WorkoutSet>(
    "SELECT * FROM workout_sets WHERE session_id = ? AND exercise_id = ? AND is_warmup = 0",
    [sessionId, exerciseId],
  );
  if (sessionSets.length === 0) return [];

  // Everything logged for this exercise before this session.
  const priorSets = all<WorkoutSet>(
    `SELECT * FROM workout_sets
      WHERE exercise_id = ? AND is_warmup = 0 AND session_id <> ? AND date <= ?`,
    [exerciseId, sessionId, date],
  );

  const detected: DetectedRecord[] = [];

  const bestOf = (sets: readonly WorkoutSet[], fn: (s: WorkoutSet) => number | null): number | null => {
    const values = sets.map(fn).filter((v): v is number => v !== null && Number.isFinite(v) && v > 0);
    return values.length ? Math.max(...values) : null;
  };

  const candidates: Array<{
    kind: StrengthKind;
    now: number | null;
    prior: number | null;
    display: (v: number) => string;
  }> = [
    {
      kind: "WEIGHT",
      now: bestOf(sessionSets, (s) => s.weight_kg),
      prior: bestOf(priorSets, (s) => s.weight_kg),
      display: (v) => {
        const at = sessionSets
          .filter((s) => (s.weight_kg ?? 0) >= v - 0.001)
          .sort((a, b) => (b.reps ?? 0) - (a.reps ?? 0))[0];
        return at?.reps ? `${fmt(v)}kg × ${at.reps}` : `${fmt(v)}kg`;
      },
    },
    {
      kind: "REPS",
      now: bestOf(sessionSets, (s) => s.reps),
      prior: bestOf(priorSets, (s) => s.reps),
      display: (v) => `${v} reps`,
    },
    {
      kind: "VOLUME",
      now: sumVolume(sessionSets),
      prior: maxSessionVolume(priorSets),
      display: (v) => `${fmt(round(v, 0))}kg total volume`,
    },
    {
      kind: "E1RM",
      now: bestOf(sessionSets, (s) => (s.weight_kg && s.reps ? estimate1RM(s.weight_kg, s.reps) : null)),
      prior: bestOf(priorSets, (s) => (s.weight_kg && s.reps ? estimate1RM(s.weight_kg, s.reps) : null)),
      display: (v) => `${fmt(v)}kg estimated 1RM`,
    },
  ];

  for (const c of candidates) {
    if (c.now === null || c.now <= 0) continue;
    // With no history there is no record to beat — the first session is a baseline.
    if (c.prior === null) continue;
    if (c.now <= c.prior + 0.0001) continue;
    detected.push({
      kind: c.kind,
      value: round(c.now, 2),
      previous: round(c.prior, 2),
      display: c.display(c.now),
    });
  }

  return detected;
}

/** Detects and persists records for a completed session. Returns what was new. */
export function recordSessionPRs(sessionId: string, date: DayString): DetectedRecord[] {
  const exerciseIds = all<{ exercise_id: string }>(
    "SELECT DISTINCT exercise_id FROM workout_sets WHERE session_id = ? AND is_warmup = 0",
    [sessionId],
  ).map((r) => r.exercise_id);

  const out: DetectedRecord[] = [];
  for (const exerciseId of exerciseIds) {
    for (const rec of detectStrengthRecords(exerciseId, sessionId, date)) {
      const already = get<{ id: string }>(
        `SELECT id FROM personal_records
          WHERE domain = 'STRENGTH' AND exercise_id = ? AND kind = ? AND source_id = ?`,
        [exerciseId, rec.kind, sessionId],
      );
      if (already) continue;
      insert("personal_records", {
        domain: "STRENGTH",
        exercise_id: exerciseId,
        station: null,
        run_distance_m: null,
        kind: rec.kind,
        value: rec.value,
        display: rec.display,
        previous_value: rec.previous,
        date,
        source_id: sessionId,
      });
      out.push(rec);
    }
  }
  return out;
}

/** Distance and pace records for a run, bucketed by rounded distance. */
export function recordRunPRs(runId: string, date: DayString): DetectedRecord[] {
  const run = get<{ distance_m: number | null; duration_sec: number | null }>(
    "SELECT distance_m, duration_sec FROM runs WHERE id = ?",
    [runId],
  );
  if (!run || !run.distance_m || !run.duration_sec) return [];

  const out: DetectedRecord[] = [];

  const longest = get<{ v: number | null }>(
    "SELECT MAX(distance_m) AS v FROM runs WHERE id <> ? AND date <= ?",
    [runId, date],
  )?.v;
  if (longest !== null && longest !== undefined && run.distance_m > longest) {
    out.push({
      kind: "DISTANCE",
      value: run.distance_m,
      previous: longest,
      display: `${(run.distance_m / 1000).toFixed(2)}km — longest run`,
    });
    persistRun(runId, date, "DISTANCE", run.distance_m, longest, out[out.length - 1].display, run.distance_m);
  }

  // Pace records are compared within a distance bucket so 1km is not
  // compared against 21km.
  const bucket = distanceBucket(run.distance_m);
  const pace = paceSecPerKm(run.distance_m, run.duration_sec);
  if (pace !== null && bucket !== null) {
    const prior = get<{ v: number | null }>(
      `SELECT MIN(avg_pace_sec) AS v FROM runs
        WHERE id <> ? AND date <= ? AND avg_pace_sec IS NOT NULL
          AND distance_m >= ? AND distance_m <= ?`,
      [runId, date, bucket.min, bucket.max],
    )?.v;
    if (prior !== null && prior !== undefined && pace < prior) {
      const display = `${fmtPace(pace)} over ${bucket.label}`;
      out.push({ kind: "PACE", value: pace, previous: prior, display });
      persistRun(runId, date, "PACE", pace, prior, display, run.distance_m);
    }
  }

  return out;
}

function persistRun(
  runId: string,
  date: DayString,
  kind: PersonalRecord["kind"],
  value: number,
  previous: number | null,
  display: string,
  distanceM: number,
) {
  const already = get<{ id: string }>(
    "SELECT id FROM personal_records WHERE domain = 'RUN' AND kind = ? AND source_id = ?",
    [kind, runId],
  );
  if (already) return;
  insert("personal_records", {
    domain: "RUN",
    exercise_id: null,
    station: null,
    run_distance_m: distanceM,
    kind,
    value,
    display,
    previous_value: previous,
    date,
    source_id: runId,
  });
}

/** Fastest recorded time at each HYROX station. */
export function recordHyroxPRs(hyroxSessionId: string, date: DayString): DetectedRecord[] {
  const stations = all<{ id: string; station: HyroxStationName; duration_sec: number | null }>(
    "SELECT id, station, duration_sec FROM hyrox_stations WHERE hyrox_session_id = ?",
    [hyroxSessionId],
  );

  const out: DetectedRecord[] = [];
  for (const s of stations) {
    if (!s.duration_sec || s.duration_sec <= 0) continue;
    const prior = get<{ v: number | null }>(
      `SELECT MIN(hs.duration_sec) AS v FROM hyrox_stations hs
         JOIN hyrox_sessions ss ON ss.id = hs.hyrox_session_id
        WHERE hs.station = ? AND hs.hyrox_session_id <> ? AND ss.date <= ?
          AND hs.duration_sec IS NOT NULL AND hs.duration_sec > 0`,
      [s.station, hyroxSessionId, date],
    )?.v;
    if (prior === null || prior === undefined || s.duration_sec >= prior) continue;

    const already = get<{ id: string }>(
      "SELECT id FROM personal_records WHERE domain = 'HYROX' AND station = ? AND source_id = ?",
      [s.station, hyroxSessionId],
    );
    if (already) continue;

    const display = `${fmtTime(s.duration_sec)} — ${s.station.replace(/_/g, " ").toLowerCase()}`;
    insert("personal_records", {
      domain: "HYROX",
      exercise_id: null,
      station: s.station,
      run_distance_m: null,
      kind: "TIME",
      value: s.duration_sec,
      display,
      previous_value: prior,
      date,
      source_id: hyroxSessionId,
    });
    out.push({ kind: "TIME", value: s.duration_sec, previous: prior, display });
  }
  return out;
}

/* ------------------------------------------------------------------ utils */

function sumVolume(sets: readonly WorkoutSet[]): number | null {
  const v = sets.reduce((t, s) => t + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
  return v > 0 ? v : null;
}

function maxSessionVolume(sets: readonly WorkoutSet[]): number | null {
  const bySession = new Map<string, number>();
  for (const s of sets) {
    bySession.set(
      s.session_id,
      (bySession.get(s.session_id) ?? 0) + (s.weight_kg ?? 0) * (s.reps ?? 0),
    );
  }
  const values = [...bySession.values()].filter((v) => v > 0);
  return values.length ? Math.max(...values) : null;
}

function distanceBucket(m: number): { min: number; max: number; label: string } | null {
  const buckets: Array<{ target: number; label: string }> = [
    { target: 1000, label: "1km" },
    { target: 5000, label: "5km" },
    { target: 10000, label: "10km" },
    { target: 21097, label: "21.1km" },
    { target: 42195, label: "42.2km" },
  ];
  for (const b of buckets) {
    if (m >= b.target * 0.95 && m <= b.target * 1.05) {
      return { min: b.target * 0.95, max: b.target * 1.05, label: b.label };
    }
  }
  return null;
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : String(round(v, 2));
}

function fmtPace(secPerKm: number): string {
  return `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, "0")}/km`;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
