"use server";

import { refreshPaths } from "./revalidate";
import { all, db, get, scalar } from "@/lib/db";
import { insert, remove, update } from "@/lib/db/repo";
import { nowIso, today } from "@/lib/core/date";
import { computeProgression } from "@/lib/domain/progression";
import {
  checkbox,
  dayWithDefault,
  fail,
  formObject,
  id,
  ok,
  optionalInt,
  optionalNumber,
  optionalText,
  parseWith,
  requiredText,
  timeToSeconds,
  z,
  type ActionResult,
} from "./shared";
import { getExercise, lastPerformance, workoutDetail } from "@/lib/services/body";
import { recordSessionPRs, type DetectedRecord } from "@/lib/services/records";
import { recomputeDayScore } from "@/lib/services/scores";
import type { Exercise, SessionExercise, WorkoutExercise } from "@/lib/types";

function refresh(...paths: string[]) {
  refreshPaths(["/", "/today", "/body", "/body/training", ...paths]);
}

/* -------------------------------------------------------------- EXERCISES */

const exerciseSchema = z.object({
  name: requiredText,
  category: z.enum(["STRENGTH", "CONDITIONING", "RUN", "HYROX", "MOBILITY"]).default("STRENGTH"),
  modality: z
    .enum([
      "WEIGHT_REPS",
      "BODYWEIGHT_REPS",
      "WEIGHTED_BODYWEIGHT",
      "TIME",
      "DISTANCE_TIME",
      "WEIGHT_DISTANCE_TIME",
      "REPS_TIME",
    ])
    .default("WEIGHT_REPS"),
  muscle_group: optionalText,
  is_compound: checkbox,
  default_rest_sec: optionalInt,
  progression_rule: z.enum(["DOUBLE_PROGRESSION", "LINEAR", "NONE"]).default("DOUBLE_PROGRESSION"),
  increment_kg: optionalNumber,
  notes: optionalText,
});

export async function createExercise(form: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = parseWith(exerciseSchema, formObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  const clash = get<{ id: string }>("SELECT id FROM exercises WHERE name = ?", [v.name]);
  if (clash) return fail(`An exercise called "${v.name}" already exists.`);

  const newId = insert("exercises", {
    name: v.name,
    category: v.category,
    modality: v.modality,
    muscle_group: v.muscle_group ?? null,
    is_compound: v.is_compound ? 1 : 0,
    default_rest_sec: v.default_rest_sec ?? (v.is_compound ? 150 : 75),
    progression_rule: v.progression_rule,
    increment_kg: v.increment_kg ?? 2.5,
    notes: v.notes ?? null,
    archived: 0,
  });
  refresh("/body/strength");
  return ok({ id: newId });
}

export async function updateExercise(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(exerciseSchema.partial().extend({ id }), formObject(form));
  if (!parsed.ok) return parsed.result;
  const { id: exerciseId, is_compound, ...rest } = parsed.value;
  update("exercises", exerciseId, {
    ...rest,
    is_compound: form.has("is_compound") ? (is_compound ? 1 : 0) : undefined,
  });
  refresh("/body/strength", `/body/strength/${exerciseId}`);
  return ok();
}

export async function archiveExercise(exerciseId: string): Promise<ActionResult> {
  update("exercises", exerciseId, { archived: 1 });
  refresh("/body/strength");
  return ok();
}

/* ------------------------------------------------------- WORKOUT LIBRARY */

export async function createWorkout(form: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = parseWith(
    z.object({
      name: requiredText,
      type: z
        .enum(["STRENGTH", "RUN", "CONDITIONING", "HYROX", "RECOVERY", "MOBILITY"])
        .default("STRENGTH"),
      focus: optionalText,
      description: optionalText,
      est_minutes: optionalInt,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  const newId = insert("workouts", {
    name: v.name,
    type: v.type,
    focus: v.focus ?? null,
    description: v.description ?? null,
    est_minutes: v.est_minutes ?? null,
    archived: 0,
  });
  refresh("/body/training/library", `/body/training/library/${newId}`);
  return ok({ id: newId });
}

export async function updateWorkout(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id,
      name: optionalText,
      type: z
        .enum(["STRENGTH", "RUN", "CONDITIONING", "HYROX", "RECOVERY", "MOBILITY"])
        .optional(),
      focus: optionalText,
      description: optionalText,
      est_minutes: optionalInt,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const { id: workoutId, ...rest } = parsed.value;
  update("workouts", workoutId, rest);
  refresh("/body/training/library", `/body/training/library/${workoutId}`);
  return ok();
}

export async function deleteWorkout(workoutId: string): Promise<ActionResult> {
  remove("workouts", workoutId);
  refresh("/body/training/library");
  return ok();
}

const prescriptionSchema = z.object({
  target_sets: optionalInt,
  rep_min: optionalInt,
  rep_max: optionalInt,
  target_weight_kg: optionalNumber,
  target_seconds: timeToSeconds,
  target_distance_m: optionalNumber,
  target_pace_sec: timeToSeconds,
  target_rpe: optionalNumber,
  target_rir_min: optionalInt,
  target_rir_max: optionalInt,
  rest_sec: optionalInt,
  tempo: optionalText,
  notes: optionalText,
});

export async function addWorkoutExercise(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    prescriptionSchema.extend({ workout_id: id, exercise_id: id }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const { workout_id, exercise_id, ...rx } = parsed.value;

  if (rx.rep_min !== undefined && rx.rep_max !== undefined && rx.rep_min > rx.rep_max) {
    return fail("The minimum rep count cannot exceed the maximum.");
  }
  const exercise = getExercise(exercise_id);
  if (!exercise) return fail("Exercise not found.");

  insert("workout_exercises", {
    workout_id,
    exercise_id,
    sort_order: scalar(
      "SELECT COALESCE(MAX(sort_order), 0) + 1 AS v FROM workout_exercises WHERE workout_id = ?",
      [workout_id],
    ),
    target_sets: rx.target_sets ?? 3,
    rep_min: rx.rep_min ?? null,
    rep_max: rx.rep_max ?? null,
    target_weight_kg: rx.target_weight_kg ?? null,
    target_seconds: rx.target_seconds ?? null,
    target_distance_m: rx.target_distance_m ?? null,
    target_pace_sec: rx.target_pace_sec ?? null,
    target_rpe: rx.target_rpe ?? null,
    target_rir_min: rx.target_rir_min ?? null,
    target_rir_max: rx.target_rir_max ?? null,
    rest_sec: rx.rest_sec ?? exercise.default_rest_sec,
    tempo: rx.tempo ?? null,
    notes: rx.notes ?? null,
  });
  refresh(`/body/training/library/${workout_id}`);
  return ok();
}

export async function updateWorkoutExercise(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(prescriptionSchema.extend({ id }), formObject(form));
  if (!parsed.ok) return parsed.result;
  const { id: rowId, ...rx } = parsed.value;
  const row = get<{ workout_id: string }>("SELECT workout_id FROM workout_exercises WHERE id = ?", [
    rowId,
  ]);
  update("workout_exercises", rowId, rx);
  if (row) refresh(`/body/training/library/${row.workout_id}`);
  return ok();
}

export async function removeWorkoutExercise(rowId: string): Promise<ActionResult> {
  const row = get<{ workout_id: string }>("SELECT workout_id FROM workout_exercises WHERE id = ?", [
    rowId,
  ]);
  remove("workout_exercises", rowId);
  if (row) refresh(`/body/training/library/${row.workout_id}`);
  return ok();
}

export async function moveWorkoutExercise(rowId: string, direction: string): Promise<ActionResult> {
  const row = get<WorkoutExercise>("SELECT * FROM workout_exercises WHERE id = ?", [rowId]);
  if (!row) return fail("Exercise not found in this workout.");
  const neighbour = get<WorkoutExercise>(
    direction === "up"
      ? "SELECT * FROM workout_exercises WHERE workout_id = ? AND sort_order < ? ORDER BY sort_order DESC LIMIT 1"
      : "SELECT * FROM workout_exercises WHERE workout_id = ? AND sort_order > ? ORDER BY sort_order LIMIT 1",
    [row.workout_id, row.sort_order],
  );
  if (!neighbour) return ok();
  update("workout_exercises", row.id, { sort_order: neighbour.sort_order });
  update("workout_exercises", neighbour.id, { sort_order: row.sort_order });
  refresh(`/body/training/library/${row.workout_id}`);
  return ok();
}

/* ----------------------------------------------------- SESSION LIFECYCLE */

/**
 * Creates a session from a template, snapshotting the prescription and
 * computing each exercise's target from its own history. Targets are
 * recommendations — every field remains editable during the session.
 */
export async function scheduleSession(form: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = parseWith(
    z.object({ workout_id: optionalText, date: dayWithDefault, name: optionalText }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const { workout_id, date, name } = parsed.value;

  if (!workout_id) {
    if (!name) return fail("Choose a workout from the library, or give the session a name.");
    const blankId = insert("workout_sessions", {
      workout_id: null,
      date,
      name,
      type: "STRENGTH",
      status: "PLANNED",
    });
    recomputeDayScore(date);
    refresh();
    return ok({ id: blankId });
  }

  const detail = workoutDetail(workout_id);
  if (!detail) return fail("Workout not found.");

  const sessionId = insert("workout_sessions", {
    workout_id,
    date,
    name: name ?? detail.workout.name,
    type: detail.workout.type,
    status: "PLANNED",
  });

  for (const row of detail.exercises) {
    const last = lastPerformance(row.exercise_id, date);
    const progression = computeProgression(row.exercise, row, last);
    insert("session_exercises", {
      session_id: sessionId,
      exercise_id: row.exercise_id,
      sort_order: row.sort_order,
      target_sets: row.target_sets,
      rep_min: progression.repMin ?? row.rep_min,
      rep_max: progression.repMax ?? row.rep_max,
      target_weight_kg: progression.weightKg ?? row.target_weight_kg,
      target_seconds: row.target_seconds,
      target_distance_m: row.target_distance_m,
      target_pace_sec: row.target_pace_sec,
      target_rpe: row.target_rpe,
      target_rir_min: row.target_rir_min,
      target_rir_max: row.target_rir_max,
      rest_sec: row.rest_sec ?? row.exercise.default_rest_sec,
      tempo: row.tempo,
      notes: row.notes,
      target_source: progression.source,
      target_rationale: progression.rationale,
    });
  }

  recomputeDayScore(date);
  refresh(`/body/training/${sessionId}`);
  return ok({ id: sessionId });
}

export async function startSession(sessionId: string): Promise<ActionResult> {
  const session = get<{ date: string; status: string }>(
    "SELECT date, status FROM workout_sessions WHERE id = ?",
    [sessionId],
  );
  if (!session) return fail("Session not found.");
  if (session.status === "COMPLETED") return fail("This session is already complete.");

  update("workout_sessions", sessionId, { status: "IN_PROGRESS", started_at: nowIso() });
  recomputeDayScore(session.date);
  refresh(`/body/training/${sessionId}`);
  return ok();
}

export async function completeSession(form: FormData): Promise<ActionResult<{ records: DetectedRecord[] }>> {
  const parsed = parseWith(
    z.object({
      id,
      duration_min: optionalInt,
      session_rpe: optionalNumber,
      notes: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  const session = get<{ date: string; started_at: string | null }>(
    "SELECT date, started_at FROM workout_sessions WHERE id = ?",
    [v.id],
  );
  if (!session) return fail("Session not found.");

  const endedAt = nowIso();
  const elapsedMin =
    session.started_at !== null
      ? Math.max(1, Math.round((Date.parse(endedAt) - Date.parse(session.started_at)) / 60_000))
      : null;

  update("workout_sessions", v.id, {
    status: "COMPLETED",
    ended_at: endedAt,
    completed_at: endedAt,
    duration_min: v.duration_min ?? elapsedMin,
    session_rpe: v.session_rpe ?? null,
    notes: v.notes ?? null,
  });

  const records = recordSessionPRs(v.id, session.date);
  recomputeDayScore(session.date);
  refresh(`/body/training/${v.id}`, "/body/dashboard");
  return ok({ records });
}

export async function setSessionStatus(sessionId: string, status: string): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id,
      status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "MODIFIED", "SKIPPED", "RECOVERY"]),
    }),
    { id: sessionId, status },
  );
  if (!parsed.ok) return parsed.result;
  const session = get<{ date: string }>("SELECT date FROM workout_sessions WHERE id = ?", [
    sessionId,
  ]);
  if (!session) return fail("Session not found.");
  update("workout_sessions", sessionId, {
    status: parsed.value.status,
    completed_at: parsed.value.status === "COMPLETED" ? nowIso() : null,
  });
  recomputeDayScore(session.date);
  refresh(`/body/training/${sessionId}`);
  return ok();
}

export async function deleteSession(sessionId: string): Promise<ActionResult> {
  const session = get<{ date: string }>("SELECT date FROM workout_sessions WHERE id = ?", [
    sessionId,
  ]);
  remove("workout_sessions", sessionId);
  if (session) recomputeDayScore(session.date);
  refresh();
  return ok();
}

/* --------------------------------------------------- SESSION PRESCRIPTION */

export async function addSessionExercise(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    prescriptionSchema.extend({ session_id: id, exercise_id: id }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const { session_id, exercise_id, ...rx } = parsed.value;

  const session = get<{ date: string }>("SELECT date FROM workout_sessions WHERE id = ?", [
    session_id,
  ]);
  if (!session) return fail("Session not found.");
  const exercise = getExercise(exercise_id);
  if (!exercise) return fail("Exercise not found.");

  const last = lastPerformance(exercise_id, session.date, session_id);
  const progression = computeProgression(
    exercise,
    {
      target_sets: rx.target_sets ?? 3,
      rep_min: rx.rep_min ?? null,
      rep_max: rx.rep_max ?? null,
      target_weight_kg: rx.target_weight_kg ?? null,
    },
    last,
  );

  insert("session_exercises", {
    session_id,
    exercise_id,
    sort_order: scalar(
      "SELECT COALESCE(MAX(sort_order), 0) + 1 AS v FROM session_exercises WHERE session_id = ?",
      [session_id],
    ),
    target_sets: rx.target_sets ?? 3,
    rep_min: rx.rep_min ?? progression.repMin ?? null,
    rep_max: rx.rep_max ?? progression.repMax ?? null,
    target_weight_kg: rx.target_weight_kg ?? progression.weightKg ?? null,
    target_seconds: rx.target_seconds ?? null,
    target_distance_m: rx.target_distance_m ?? null,
    target_pace_sec: rx.target_pace_sec ?? null,
    target_rpe: rx.target_rpe ?? null,
    target_rir_min: rx.target_rir_min ?? null,
    target_rir_max: rx.target_rir_max ?? null,
    rest_sec: rx.rest_sec ?? exercise.default_rest_sec,
    tempo: rx.tempo ?? null,
    notes: rx.notes ?? null,
    target_source: rx.target_weight_kg !== undefined ? "MANUAL" : progression.source,
    target_rationale: progression.rationale,
  });
  refresh(`/body/training/${session_id}`);
  return ok();
}

export async function updateSessionExercise(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(prescriptionSchema.extend({ id }), formObject(form));
  if (!parsed.ok) return parsed.result;
  const { id: rowId, ...rx } = parsed.value;
  const row = get<{ session_id: string }>("SELECT session_id FROM session_exercises WHERE id = ?", [
    rowId,
  ]);
  if (!row) return fail("Exercise not found in this session.");
  update("session_exercises", rowId, { ...rx, target_source: "MANUAL" });
  refresh(`/body/training/${row.session_id}`);
  return ok();
}

export async function removeSessionExercise(rowId: string): Promise<ActionResult> {
  const row = get<{ session_id: string }>("SELECT session_id FROM session_exercises WHERE id = ?", [
    rowId,
  ]);
  remove("session_exercises", rowId);
  if (row) refresh(`/body/training/${row.session_id}`);
  return ok();
}

/** Re-derives targets from history — used after editing past sessions. */
export async function recomputeSessionTargets(sessionId: string): Promise<ActionResult> {
  const session = get<{ date: string }>("SELECT date FROM workout_sessions WHERE id = ?", [
    sessionId,
  ]);
  if (!session) return fail("Session not found.");

  const rows = all<SessionExercise>(
    "SELECT * FROM session_exercises WHERE session_id = ? ORDER BY sort_order",
    [sessionId],
  );
  for (const row of rows) {
    const exercise = getExercise(row.exercise_id);
    if (!exercise) continue;
    const last = lastPerformance(row.exercise_id, session.date, sessionId);
    const progression = computeProgression(exercise, row, last);
    update("session_exercises", row.id, {
      target_weight_kg: progression.weightKg,
      rep_min: progression.repMin,
      rep_max: progression.repMax,
      target_source: progression.source,
      target_rationale: progression.rationale,
    });
  }
  refresh(`/body/training/${sessionId}`);
  return ok();
}

/* --------------------------------------------------------------- LOG SETS */

const setSchema = z.object({
  session_exercise_id: id,
  weight_kg: optionalNumber,
  reps: optionalInt,
  seconds: timeToSeconds,
  distance_m: optionalNumber,
  rpe: optionalNumber,
  rir: optionalInt,
  is_warmup: checkbox,
  notes: optionalText,
});

export async function logSet(form: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = parseWith(setSchema, formObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  const sx = get<SessionExercise>("SELECT * FROM session_exercises WHERE id = ?", [
    v.session_exercise_id,
  ]);
  if (!sx) return fail("Exercise not found in this session.");
  const session = get<{ date: string; status: string }>(
    "SELECT date, status FROM workout_sessions WHERE id = ?",
    [sx.session_id],
  );
  if (!session) return fail("Session not found.");

  const hasWork =
    (v.reps ?? 0) > 0 || (v.seconds ?? 0) > 0 || (v.distance_m ?? 0) > 0;
  if (!hasWork) return fail("Log reps, time or distance — an empty set is not a set.");
  if (v.rpe !== undefined && (v.rpe < 1 || v.rpe > 10)) return fail("RPE must be between 1 and 10.");
  if (v.rir !== undefined && (v.rir < 0 || v.rir > 10)) return fail("RIR must be between 0 and 10.");
  if (v.weight_kg !== undefined && v.weight_kg < 0) return fail("Weight cannot be negative.");

  const nextIndex =
    scalar(
      "SELECT COALESCE(MAX(set_index), 0) AS v FROM workout_sets WHERE session_exercise_id = ?",
      [v.session_exercise_id],
    ) + 1;

  const setId = insert("workout_sets", {
    session_exercise_id: v.session_exercise_id,
    session_id: sx.session_id,
    exercise_id: sx.exercise_id,
    date: session.date,
    set_index: nextIndex,
    weight_kg: v.weight_kg ?? null,
    reps: v.reps ?? null,
    seconds: v.seconds ?? null,
    distance_m: v.distance_m ?? null,
    rpe: v.rpe ?? null,
    rir: v.rir ?? null,
    is_warmup: v.is_warmup ? 1 : 0,
    notes: v.notes ?? null,
  });

  // Logging a set puts the session in progress if it was not already.
  if (session.status === "PLANNED") {
    update("workout_sessions", sx.session_id, { status: "IN_PROGRESS", started_at: nowIso() });
  }

  recomputeDayScore(session.date);
  refresh(`/body/training/${sx.session_id}`);
  return ok({ id: setId });
}

export async function updateSet(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(setSchema.partial().extend({ id }), formObject(form));
  if (!parsed.ok) return parsed.result;
  const { id: setId, session_exercise_id: _ignored, is_warmup, ...rest } = parsed.value;

  const row = get<{ session_id: string; date: string }>(
    "SELECT session_id, date FROM workout_sets WHERE id = ?",
    [setId],
  );
  if (!row) return fail("Set not found.");

  update("workout_sets", setId, {
    ...rest,
    is_warmup: form.has("is_warmup") ? (is_warmup ? 1 : 0) : undefined,
  });
  recomputeDayScore(row.date);
  refresh(`/body/training/${row.session_id}`);
  return ok();
}

export async function deleteSet(setId: string): Promise<ActionResult> {
  const row = get<{ session_id: string; session_exercise_id: string; date: string }>(
    "SELECT session_id, session_exercise_id, date FROM workout_sets WHERE id = ?",
    [setId],
  );
  if (!row) return fail("Set not found.");
  remove("workout_sets", setId);

  // Renumber so set indices stay contiguous.
  const remaining = all<{ id: string }>(
    "SELECT id FROM workout_sets WHERE session_exercise_id = ? ORDER BY set_index",
    [row.session_exercise_id],
  );
  const stmt = db().prepare("UPDATE workout_sets SET set_index = ? WHERE id = ?");
  remaining.forEach((r, i) => stmt.run(i + 1, r.id));

  recomputeDayScore(row.date);
  refresh(`/body/training/${row.session_id}`);
  return ok();
}

/** Repeats the previous set's numbers — the fastest possible logging path. */
export async function repeatLastSet(
  sessionExerciseId: string,
): Promise<ActionResult<{ id: string }>> {
  const last = get<{
    weight_kg: number | null;
    reps: number | null;
    seconds: number | null;
    distance_m: number | null;
    rpe: number | null;
    rir: number | null;
  }>(
    "SELECT * FROM workout_sets WHERE session_exercise_id = ? ORDER BY set_index DESC LIMIT 1",
    [sessionExerciseId],
  );
  if (!last) return fail("There is no previous set to repeat.");

  const form = new FormData();
  form.set("session_exercise_id", sessionExerciseId);
  if (last.weight_kg !== null) form.set("weight_kg", String(last.weight_kg));
  if (last.reps !== null) form.set("reps", String(last.reps));
  if (last.seconds !== null) form.set("seconds", String(last.seconds));
  if (last.distance_m !== null) form.set("distance_m", String(last.distance_m));
  if (last.rpe !== null) form.set("rpe", String(last.rpe));
  if (last.rir !== null) form.set("rir", String(last.rir));
  return logSet(form);
}

/** One-tap logging of the prescribed target. */
export async function logTargetSet(
  sessionExerciseId: string,
): Promise<ActionResult<{ id: string }>> {
  const sx = get<SessionExercise>("SELECT * FROM session_exercises WHERE id = ?", [
    sessionExerciseId,
  ]);
  if (!sx) return fail("Exercise not found in this session.");
  const exercise = get<Exercise>("SELECT * FROM exercises WHERE id = ?", [sx.exercise_id]);
  if (!exercise) return fail("Exercise not found.");

  const reps = sx.rep_max ?? sx.rep_min;
  if (reps === null && sx.target_seconds === null && sx.target_distance_m === null) {
    return fail("This exercise has no target to log. Enter the set manually.");
  }

  const form = new FormData();
  form.set("session_exercise_id", sessionExerciseId);
  if (sx.target_weight_kg !== null) form.set("weight_kg", String(sx.target_weight_kg));
  if (reps !== null) form.set("reps", String(reps));
  if (sx.target_seconds !== null) form.set("seconds", String(sx.target_seconds));
  if (sx.target_distance_m !== null) form.set("distance_m", String(sx.target_distance_m));
  return logSet(form);
}

/* ------------------------------------------------------------ QUICK START */

/** Creates and starts a session in one step, from the command palette. */
export async function quickStartWorkout(workoutId: string): Promise<ActionResult<{ id: string }>> {
  const form = new FormData();
  form.set("workout_id", workoutId);
  form.set("date", today());
  const result = await scheduleSession(form);
  if (!result.ok) return result;
  await startSession(result.data.id);
  return result;
}
