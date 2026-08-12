import "server-only";

import { all, get, scalar } from "@/lib/db";
import { byId } from "@/lib/db/repo";
import {
  addDays,
  daysBetween,
  endOfWeek,
  lastNDays,
  startOfWeek,
  today,
  type DayString,
} from "@/lib/core/date";
import { computeProgression, type ProgressionResult } from "@/lib/domain/progression";
import { estimate1RM, groupSetsBySession, summariseSets } from "@/lib/domain/strength";
import { analyseLoad, sessionLoad, volumeByMuscleGroup } from "@/lib/domain/load";
import { assessReadiness, type ReadinessResult } from "@/lib/domain/recovery";
import { analyseNutritionTrend, remaining } from "@/lib/domain/nutrition";
import { analyseIntervals, paceSecPerKm, weeklyMileage } from "@/lib/domain/running";
import { analyseSimulation, projectRaceTime, stationProfiles } from "@/lib/domain/hyrox";
import { mean, round } from "@/lib/domain/stats";
import type {
  BodyMeasurement,
  Exercise,
  HyroxSession,
  HyroxStation,
  Meal,
  MealPreset,
  NutritionLog,
  NutritionTarget,
  PersonalRecord,
  RecoveryLog,
  Run,
  RunInterval,
  SessionExercise,
  Workout,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from "@/lib/types";

/* --------------------------------------------------------------- exercises */

export function listExercises(includeArchived = false): Exercise[] {
  return all<Exercise>(
    `SELECT * FROM exercises ${includeArchived ? "" : "WHERE archived = 0"} ORDER BY category, name`,
  );
}

export function getExercise(id: string): Exercise | undefined {
  return byId<Exercise>("exercises", id);
}

export function exerciseByName(name: string): Exercise | undefined {
  return get<Exercise>("SELECT * FROM exercises WHERE name = ?", [name]);
}

/* ------------------------------------------------------- workout templates */

export function listWorkouts(includeArchived = false): Workout[] {
  return all<Workout>(
    `SELECT * FROM workouts ${includeArchived ? "" : "WHERE archived = 0"} ORDER BY type, name`,
  );
}

export function getWorkout(id: string): Workout | undefined {
  return byId<Workout>("workouts", id);
}

export interface WorkoutDetail {
  workout: Workout;
  exercises: Array<WorkoutExercise & { exercise: Exercise }>;
}

export function workoutDetail(id: string): WorkoutDetail | undefined {
  const workout = getWorkout(id);
  if (!workout) return undefined;
  const rows = all<WorkoutExercise>(
    "SELECT * FROM workout_exercises WHERE workout_id = ? ORDER BY sort_order",
    [id],
  );
  const exercises = rows
    .map((row) => {
      const exercise = getExercise(row.exercise_id);
      return exercise ? { ...row, exercise } : null;
    })
    .filter((v): v is WorkoutExercise & { exercise: Exercise } => v !== null);
  return { workout, exercises };
}

/* ---------------------------------------------------------------- sessions */

export function getSession(id: string): WorkoutSession | undefined {
  return byId<WorkoutSession>("workout_sessions", id);
}

export function sessionsForDay(day: DayString): WorkoutSession[] {
  return all<WorkoutSession>("SELECT * FROM workout_sessions WHERE date = ? ORDER BY created_at", [
    day,
  ]);
}

export function sessionsInRange(from: DayString, to: DayString): WorkoutSession[] {
  return all<WorkoutSession>(
    "SELECT * FROM workout_sessions WHERE date BETWEEN ? AND ? ORDER BY date, created_at",
    [from, to],
  );
}

export function recentSessions(limit = 20): WorkoutSession[] {
  return all<WorkoutSession>(
    "SELECT * FROM workout_sessions ORDER BY date DESC, created_at DESC LIMIT ?",
    [limit],
  );
}

export function activeSession(): WorkoutSession | undefined {
  return get<WorkoutSession>(
    "SELECT * FROM workout_sessions WHERE status = 'IN_PROGRESS' ORDER BY started_at DESC LIMIT 1",
  );
}

export function sessionSets(sessionId: string): WorkoutSet[] {
  return all<WorkoutSet>(
    "SELECT * FROM workout_sets WHERE session_id = ? ORDER BY set_index",
    [sessionId],
  );
}

/** The most recent completed performance of an exercise strictly before `before`. */
export function lastPerformance(
  exerciseId: string,
  before: DayString,
  excludeSessionId?: string,
): { date: DayString; sets: WorkoutSet[] } | null {
  const row = get<{ date: string; session_id: string }>(
    `SELECT date, session_id FROM workout_sets
      WHERE exercise_id = ? AND date < ? AND is_warmup = 0
        ${excludeSessionId ? "AND session_id <> ?" : ""}
      ORDER BY date DESC, created_at DESC LIMIT 1`,
    excludeSessionId ? [exerciseId, before, excludeSessionId] : [exerciseId, before],
  );
  if (!row) return null;
  const sets = all<WorkoutSet>(
    "SELECT * FROM workout_sets WHERE session_id = ? AND exercise_id = ? ORDER BY set_index",
    [row.session_id, exerciseId],
  );
  return { date: row.date, sets };
}

export interface LiveExercise {
  sessionExercise: SessionExercise;
  exercise: Exercise;
  sets: WorkoutSet[];
  last: { date: DayString; sets: WorkoutSet[] } | null;
  progression: ProgressionResult;
  restSec: number;
}

export interface SessionDetail {
  session: WorkoutSession;
  exercises: LiveExercise[];
  totalSets: number;
  completedSets: number;
  volumeKg: number;
  run: RunDetail | null;
  hyrox: HyroxDetail | null;
}

export function sessionDetail(sessionId: string): SessionDetail | undefined {
  const session = getSession(sessionId);
  if (!session) return undefined;

  const rows = all<SessionExercise>(
    "SELECT * FROM session_exercises WHERE session_id = ? ORDER BY sort_order",
    [sessionId],
  );
  const allSets = sessionSets(sessionId);

  const exercises: LiveExercise[] = [];
  for (const row of rows) {
    const exercise = getExercise(row.exercise_id);
    if (!exercise) continue;
    const sets = allSets.filter((s) => s.session_exercise_id === row.id);
    const last = lastPerformance(row.exercise_id, session.date, sessionId);
    exercises.push({
      sessionExercise: row,
      exercise,
      sets,
      last,
      progression: computeProgression(exercise, row, last),
      restSec: row.rest_sec ?? exercise.default_rest_sec,
    });
  }

  const totalSets = rows.reduce((t, r) => t + r.target_sets, 0);
  const completedSets = allSets.filter((s) => !s.is_warmup).length;

  return {
    session,
    exercises,
    totalSets,
    completedSets,
    volumeKg: summariseSets(allSets).volumeKg,
    run: runForSession(sessionId),
    hyrox: hyroxForSession(sessionId),
  };
}

/* --------------------------------------------------------- exercise history */

export interface ExerciseHistory {
  exercise: Exercise;
  sessions: ReturnType<typeof groupSetsBySession>;
  bestWeightKg: number | null;
  bestReps: number | null;
  bestVolumeKg: number | null;
  bestE1RM: number | null;
  totalSessions: number;
  totalSets: number;
  avgRpe: number | null;
  frequencyPerWeek: number | null;
  volumeSeries: Array<{ date: string; volume: number }>;
  e1rmSeries: Array<{ date: string; value: number }>;
  records: PersonalRecord[];
}

export function exerciseHistory(exerciseId: string, limitSessions = 40): ExerciseHistory | undefined {
  const exercise = getExercise(exerciseId);
  if (!exercise) return undefined;

  const sets = all<WorkoutSet>(
    "SELECT * FROM workout_sets WHERE exercise_id = ? AND is_warmup = 0 ORDER BY date DESC, set_index",
    [exerciseId],
  );
  const sessions = groupSetsBySession(sets).slice(0, limitSessions);

  const weights = sets.map((s) => s.weight_kg ?? 0).filter((v) => v > 0);
  const reps = sets.map((s) => s.reps ?? 0).filter((v) => v > 0);
  const e1rms = sets
    .map((s) => (s.weight_kg && s.reps ? estimate1RM(s.weight_kg, s.reps) : null))
    .filter((v): v is number => v !== null);
  const rpes = sets.map((s) => s.rpe).filter((v): v is number => v !== null);

  const dates = [...new Set(sets.map((s) => s.date))].sort();
  let frequency: number | null = null;
  if (dates.length >= 2) {
    const spanDays =
      Math.abs(
        (Date.parse(`${dates[dates.length - 1]}T12:00:00Z`) - Date.parse(`${dates[0]}T12:00:00Z`)) /
          86_400_000,
      ) + 1;
    frequency = round((dates.length / spanDays) * 7, 2);
  }

  const ordered = [...sessions].reverse();

  return {
    exercise,
    sessions,
    bestWeightKg: weights.length ? Math.max(...weights) : null,
    bestReps: reps.length ? Math.max(...reps) : null,
    bestVolumeKg: sessions.length ? Math.max(...sessions.map((s) => s.summary.volumeKg)) : null,
    bestE1RM: e1rms.length ? Math.max(...e1rms) : null,
    totalSessions: dates.length,
    totalSets: sets.length,
    avgRpe: rpes.length ? round(mean(rpes) ?? 0, 1) : null,
    frequencyPerWeek: frequency,
    volumeSeries: ordered.map((s) => ({ date: s.date, volume: s.summary.volumeKg })),
    e1rmSeries: ordered
      .map((s) => ({ date: s.date, value: s.summary.bestE1RM }))
      .filter((p): p is { date: string; value: number } => p.value !== null),
    records: all<PersonalRecord>(
      "SELECT * FROM personal_records WHERE exercise_id = ? ORDER BY date DESC",
      [exerciseId],
    ),
  };
}

/* ---------------------------------------------------------------- records */

export function recentRecords(limit = 12): Array<PersonalRecord & { exerciseName: string | null }> {
  return all<PersonalRecord & { exerciseName: string | null }>(
    `SELECT pr.*, e.name AS exerciseName
       FROM personal_records pr
       LEFT JOIN exercises e ON e.id = pr.exercise_id
      ORDER BY pr.date DESC, pr.created_at DESC LIMIT ?`,
    [limit],
  );
}

export function recordsOnDate(day: DayString): Array<PersonalRecord & { exerciseName: string | null }> {
  return all<PersonalRecord & { exerciseName: string | null }>(
    `SELECT pr.*, e.name AS exerciseName
       FROM personal_records pr
       LEFT JOIN exercises e ON e.id = pr.exercise_id
      WHERE pr.date = ? ORDER BY pr.created_at DESC`,
    [day],
  );
}

/* ------------------------------------------------------------------ runs */

export function listRuns(limit = 50): Run[] {
  return all<Run>("SELECT * FROM runs ORDER BY date DESC, created_at DESC LIMIT ?", [limit]);
}

export function getRun(id: string): Run | undefined {
  return byId<Run>("runs", id);
}

export interface RunDetail {
  run: Run;
  intervals: RunInterval[];
  analysis: ReturnType<typeof analyseIntervals>;
}

export function runDetail(id: string): RunDetail | undefined {
  const run = getRun(id);
  if (!run) return undefined;
  const intervals = all<RunInterval>(
    "SELECT * FROM run_intervals WHERE run_id = ? ORDER BY interval_index",
    [id],
  );
  return { run, intervals, analysis: analyseIntervals(intervals) };
}

export function runForSession(sessionId: string): RunDetail | null {
  const run = get<Run>("SELECT * FROM runs WHERE session_id = ?", [sessionId]);
  if (!run) return null;
  return runDetail(run.id) ?? null;
}

export interface RunningOverview {
  runs: Run[];
  weeks: ReturnType<typeof weeklyMileage>;
  totalDistance30: number;
  totalTime30: number;
  avgPace30: number | null;
  bestPace: { run: Run; pace: number } | null;
  longest: Run | null;
}

export function runningOverview(day: DayString = today()): RunningOverview {
  const runs = listRuns(120);
  const from30 = addDays(day, -29);
  const recent = runs.filter((r) => r.date >= from30 && r.date <= day);
  const paces = recent
    .map((r) => r.avg_pace_sec ?? paceSecPerKm(r.distance_m, r.duration_sec))
    .filter((v): v is number => v !== null && v > 0);

  const paced = runs
    .map((r) => ({ run: r, pace: r.avg_pace_sec ?? paceSecPerKm(r.distance_m, r.duration_sec) }))
    .filter((p): p is { run: Run; pace: number } => p.pace !== null && p.pace > 0);

  return {
    runs,
    weeks: weeklyMileage(runs, startOfWeek),
    totalDistance30: recent.reduce((t, r) => t + (r.distance_m ?? 0), 0),
    totalTime30: recent.reduce((t, r) => t + (r.duration_sec ?? 0), 0),
    avgPace30: paces.length ? Math.round(mean(paces) ?? 0) : null,
    bestPace: paced.length ? paced.reduce((a, b) => (b.pace < a.pace ? b : a)) : null,
    longest: runs.length
      ? runs.reduce((a, b) => ((b.distance_m ?? 0) > (a.distance_m ?? 0) ? b : a))
      : null,
  };
}

/* ----------------------------------------------------------------- hyrox */

export function listHyroxSessions(limit = 30): HyroxSession[] {
  return all<HyroxSession>("SELECT * FROM hyrox_sessions ORDER BY date DESC LIMIT ?", [limit]);
}

export function getHyroxSession(id: string): HyroxSession | undefined {
  return byId<HyroxSession>("hyrox_sessions", id);
}

export interface HyroxDetail {
  session: HyroxSession;
  stations: HyroxStation[];
  analysis: ReturnType<typeof analyseSimulation>;
}

export function hyroxDetail(id: string): HyroxDetail | undefined {
  const session = getHyroxSession(id);
  if (!session) return undefined;
  const stations = all<HyroxStation>(
    "SELECT * FROM hyrox_stations WHERE hyrox_session_id = ? ORDER BY sequence",
    [id],
  );
  return { session, stations, analysis: analyseSimulation(stations, allStationProfiles()) };
}

export function hyroxForSession(sessionId: string): HyroxDetail | null {
  const row = get<HyroxSession>("SELECT * FROM hyrox_sessions WHERE session_id = ?", [sessionId]);
  if (!row) return null;
  return hyroxDetail(row.id) ?? null;
}

export function allStationProfiles() {
  const rows = all<{ station: HyroxStation["station"]; duration_sec: number | null; date: string }>(
    `SELECT hs.station, hs.duration_sec, s.date
       FROM hyrox_stations hs
       JOIN hyrox_sessions s ON s.id = hs.hyrox_session_id`,
  );
  return stationProfiles(rows);
}

export function hyroxOverview() {
  const profiles = allStationProfiles();
  const sessions = listHyroxSessions(30);
  const sims = sessions.filter((s) => s.kind === "FULL_SIM" || s.kind === "RACE");
  return {
    profiles,
    projection: projectRaceTime(profiles),
    sessions,
    simulations: sims,
    bestSimulation: sims
      .filter((s) => s.total_sec !== null)
      .sort((a, b) => (a.total_sec as number) - (b.total_sec as number))[0],
  };
}

/* ------------------------------------------------------------- nutrition */

export function nutritionTargetFor(day: DayString = today()): NutritionTarget | undefined {
  return get<NutritionTarget>(
    "SELECT * FROM nutrition_targets WHERE effective_from <= ? ORDER BY effective_from DESC LIMIT 1",
    [day],
  );
}

export function nutritionLogFor(day: DayString): NutritionLog | undefined {
  return get<NutritionLog>("SELECT * FROM nutrition_logs WHERE date = ?", [day]);
}

export function mealsFor(day: DayString): Meal[] {
  return all<Meal>("SELECT * FROM meals WHERE date = ? ORDER BY logged_at", [day]);
}

export function mealPresets(): MealPreset[] {
  return all<MealPreset>("SELECT * FROM meal_presets ORDER BY use_count DESC, name LIMIT 24");
}

export interface NutritionDay {
  date: DayString;
  log: NutritionLog | null;
  target: NutritionTarget | null;
  meals: Meal[];
  remaining: ReturnType<typeof remaining> | null;
  proteinPct: number | null;
  caloriePct: number | null;
}

export function nutritionDay(day: DayString = today()): NutritionDay {
  const log = nutritionLogFor(day) ?? null;
  const target = nutritionTargetFor(day) ?? null;
  const consumed = log ?? {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
  };
  return {
    date: day,
    log,
    target,
    meals: mealsFor(day),
    remaining: target ? remaining(consumed, target) : null,
    proteinPct: target && target.protein_g > 0 ? round((consumed.protein_g / target.protein_g) * 100, 0) : null,
    caloriePct: target && target.calories > 0 ? round((consumed.calories / target.calories) * 100, 0) : null,
  };
}

export function nutritionTrend(windowDays = 28, day: DayString = today()) {
  const days = lastNDays(windowDays, day);
  const logs = new Map(
    all<NutritionLog>("SELECT * FROM nutrition_logs WHERE date BETWEEN ? AND ?", [
      days[0],
      day,
    ]).map((l) => [l.date, l]),
  );
  const weights = new Map(
    all<BodyMeasurement>(
      "SELECT * FROM body_measurements WHERE date BETWEEN ? AND ? AND weight_kg IS NOT NULL",
      [days[0], day],
    ).map((m) => [m.date, m.weight_kg]),
  );
  const target = nutritionTargetFor(day);

  return analyseNutritionTrend({
    calories: days.map((d) => logs.get(d)?.calories ?? null),
    proteinG: days.map((d) => logs.get(d)?.protein_g ?? null),
    weightKg: days.map((d) => weights.get(d) ?? null),
    calorieTarget: target?.calories ?? 0,
    proteinTarget: target?.protein_g ?? 0,
    intendedWeeklyKg: target?.weight_trend_kg_per_week ?? null,
    windowDays,
  });
}

/* --------------------------------------------------------- measurements */

export function listMeasurements(limit = 200): BodyMeasurement[] {
  return all<BodyMeasurement>("SELECT * FROM body_measurements ORDER BY date DESC LIMIT ?", [limit]);
}

export function latestMeasurement(): BodyMeasurement | undefined {
  return get<BodyMeasurement>("SELECT * FROM body_measurements ORDER BY date DESC LIMIT 1");
}

export type MeasurementField =
  | "weight_kg"
  | "waist_cm"
  | "chest_cm"
  | "arm_cm"
  | "shoulder_cm"
  | "thigh_cm"
  | "hip_cm"
  | "neck_cm"
  | "body_fat_pct";

export interface CompositionComparison {
  field: MeasurementField;
  label: string;
  unit: string;
  current: number | null;
  windows: Array<{ label: string; days: number | null; value: number | null; delta: number | null }>;
}

const FIELDS: Array<{ field: MeasurementField; label: string; unit: string }> = [
  { field: "weight_kg", label: "Weight", unit: "kg" },
  { field: "body_fat_pct", label: "Body fat", unit: "%" },
  { field: "waist_cm", label: "Waist", unit: "cm" },
  { field: "chest_cm", label: "Chest", unit: "cm" },
  { field: "shoulder_cm", label: "Shoulders", unit: "cm" },
  { field: "arm_cm", label: "Arms", unit: "cm" },
  { field: "thigh_cm", label: "Thighs", unit: "cm" },
  { field: "hip_cm", label: "Hips", unit: "cm" },
  { field: "neck_cm", label: "Neck", unit: "cm" },
];

export function compositionComparisons(day: DayString = today()): CompositionComparison[] {
  const rows = listMeasurements(500);
  if (rows.length === 0) {
    return FIELDS.map((f) => ({ ...f, current: null, windows: [] }));
  }

  const windows: Array<{ label: string; days: number | null }> = [
    { label: "7 days", days: 7 },
    { label: "30 days", days: 30 },
    { label: "90 days", days: 90 },
    { label: "1 year", days: 365 },
    { label: "All time", days: null },
  ];

  return FIELDS.map(({ field, label, unit }) => {
    const withValue = rows.filter((r) => r[field] !== null);
    const current = withValue.length ? (withValue[0][field] as number) : null;
    return {
      field,
      label,
      unit,
      current,
      windows: windows.map((w) => {
        let reference: BodyMeasurement | undefined;
        if (w.days === null) {
          reference = withValue[withValue.length - 1];
        } else {
          const cutoff = addDays(day, -w.days);
          // Nearest reading at or before the cutoff.
          reference = withValue.find((r) => r.date <= cutoff);
        }
        const value = reference ? (reference[field] as number | null) : null;
        return {
          label: w.label,
          days: w.days,
          value,
          delta: current !== null && value !== null ? round(current - value, 2) : null,
        };
      }),
    };
  });
}

/* ---------------------------------------------------------------- recovery */

export function recoveryFor(day: DayString): RecoveryLog | undefined {
  return get<RecoveryLog>("SELECT * FROM recovery_logs WHERE date = ?", [day]);
}

export function listRecovery(limit = 60): RecoveryLog[] {
  return all<RecoveryLog>("SELECT * FROM recovery_logs ORDER BY date DESC LIMIT ?", [limit]);
}

export function readinessFor(day: DayString = today()): ReadinessResult {
  const log = recoveryFor(day);
  const recentRpe = all<{ session_rpe: number | null }>(
    `SELECT session_rpe FROM workout_sessions
      WHERE date BETWEEN ? AND ? AND status = 'COMPLETED' AND session_rpe IS NOT NULL
      ORDER BY date DESC LIMIT 3`,
    [addDays(day, -6), day],
  ).map((r) => r.session_rpe as number);

  // Consecutive training days immediately before today.
  let consecutive = 0;
  for (let i = 1; i <= 10; i++) {
    const d = addDays(day, -i);
    const trained = scalar(
      "SELECT COUNT(*) AS v FROM workout_sessions WHERE date = ? AND status = 'COMPLETED'",
      [d],
    );
    if (trained > 0) consecutive++;
    else break;
  }

  return assessReadiness({
    sleepHours: log?.sleep_hours ?? null,
    sleepQuality: log?.sleep_quality ?? null,
    energy: log?.energy ?? null,
    stress: log?.stress ?? null,
    soreness: log?.soreness ?? null,
    recentSessionRpe: recentRpe.length ? round(mean(recentRpe) ?? 0, 1) : null,
    consecutiveTrainingDays: consecutive,
  });
}

/* ----------------------------------------------------------- training load */

export function trainingLoad(day: DayString = today()) {
  const sessions = all<WorkoutSession>(
    "SELECT * FROM workout_sessions WHERE date BETWEEN ? AND ? AND status = 'COMPLETED'",
    [addDays(day, -34), day],
  );
  const points = sessions
    .map((s) => ({ date: s.date, load: sessionLoad(s.duration_min, s.session_rpe) }))
    .filter((p): p is { date: string; load: number } => p.load !== null);
  return analyseLoad(points, day);
}

export function weeklyVolumeByGroup(day: DayString = today()) {
  const from = startOfWeek(day);
  const rows = all<{ muscle_group: string | null; weight_kg: number | null; reps: number | null }>(
    `SELECT e.muscle_group, ws.weight_kg, ws.reps
       FROM workout_sets ws
       JOIN exercises e ON e.id = ws.exercise_id
      WHERE ws.date BETWEEN ? AND ? AND ws.is_warmup = 0`,
    [from, endOfWeek(day)],
  );
  return volumeByMuscleGroup(rows);
}

/* ------------------------------------------------------- training calendar */

export interface CalendarDay {
  date: DayString;
  sessions: WorkoutSession[];
  loadUnits: number | null;
  isRestDay: boolean;
}

export function trainingWeek(day: DayString = today()): CalendarDay[] {
  const from = startOfWeek(day);
  const to = endOfWeek(day);
  const sessions = sessionsInRange(from, to);
  const recovery = new Map(
    all<RecoveryLog>("SELECT * FROM recovery_logs WHERE date BETWEEN ? AND ?", [from, to]).map(
      (r) => [r.date, r],
    ),
  );
  return daysBetween(from, to).map((date) => {
    const daySessions = sessions.filter((s) => s.date === date);
    const loads = daySessions
      .map((s) => sessionLoad(s.duration_min, s.session_rpe))
      .filter((v): v is number => v !== null);
    return {
      date,
      sessions: daySessions,
      loadUnits: loads.length ? loads.reduce((a, b) => a + b, 0) : null,
      isRestDay: (recovery.get(date)?.is_rest_day ?? 0) === 1,
    };
  });
}

/* -------------------------------------------------------------- dashboard */

export interface BodyDashboard {
  todaySessions: WorkoutSession[];
  activeSession: WorkoutSession | undefined;
  week: CalendarDay[];
  load: ReturnType<typeof analyseLoad>;
  readiness: ReadinessResult;
  nutrition: NutritionDay;
  nutritionTrend: ReturnType<typeof analyseNutritionTrend>;
  latestMeasurement: BodyMeasurement | undefined;
  records: Array<PersonalRecord & { exerciseName: string | null }>;
  volumeByGroup: ReturnType<typeof volumeByMuscleGroup>;
  weeklyDistanceM: number;
  sessionsThisWeek: number;
}

export function bodyDashboard(day: DayString = today()): BodyDashboard {
  const week = trainingWeek(day);
  const weekDistance = scalar(
    "SELECT COALESCE(SUM(distance_m), 0) AS v FROM runs WHERE date BETWEEN ? AND ?",
    [startOfWeek(day), endOfWeek(day)],
  );
  return {
    todaySessions: sessionsForDay(day),
    activeSession: activeSession(),
    week,
    load: trainingLoad(day),
    readiness: readinessFor(day),
    nutrition: nutritionDay(day),
    nutritionTrend: nutritionTrend(28, day),
    latestMeasurement: latestMeasurement(),
    records: recentRecords(6),
    volumeByGroup: weeklyVolumeByGroup(day),
    weeklyDistanceM: weekDistance,
    sessionsThisWeek: week.reduce(
      (t, d) => t + d.sessions.filter((s) => s.status === "COMPLETED").length,
      0,
    ),
  };
}
