"use server";

import { refreshPaths } from "./revalidate";
import { all, db, get } from "@/lib/db";
import { insert, remove, update } from "@/lib/db/repo";
import { nowIso, today } from "@/lib/core/date";
import { paceSecPerKm } from "@/lib/domain/running";
import { STATION_DEFAULTS, buildRaceSequence } from "@/lib/domain/hyrox";
import { HYROX_STATIONS } from "@/lib/types";
import {
  checkbox,
  dayWithDefault,
  fail,
  formObject,
  id,
  ok,
  optionalDay,
  optionalInt,
  optionalNumber,
  optionalText,
  parseWith,
  requiredText,
  timeToSeconds,
  z,
  type ActionResult,
} from "./shared";
import { recordHyroxPRs, recordRunPRs, type DetectedRecord } from "@/lib/services/records";
import { recomputeDayScore } from "@/lib/services/scores";
import type { NutritionLog } from "@/lib/types";

function refresh(...paths: string[]) {
  refreshPaths(["/", "/today", "/body", ...paths]);
}

/* ------------------------------------------------------------------- RUNS */

const runSchema = z.object({
  date: dayWithDefault,
  type: z
    .enum(["EASY", "ZONE2", "TEMPO", "INTERVALS", "LONG", "RACE", "RECOVERY"])
    .default("EASY"),
  distance_km: optionalNumber,
  duration: timeToSeconds,
  avg_hr: optionalInt,
  max_hr: optionalInt,
  elevation_m: optionalNumber,
  rpe: optionalNumber,
  target_distance_km: optionalNumber,
  target_pace: timeToSeconds,
  notes: optionalText,
  session_id: optionalText,
});

export async function logRun(form: FormData): Promise<ActionResult<{ id: string; records: DetectedRecord[] }>> {
  const parsed = parseWith(runSchema, formObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  if (v.distance_km === undefined && v.duration === undefined) {
    return fail("Log at least a distance or a duration.");
  }
  if (v.distance_km !== undefined && v.distance_km <= 0) return fail("Distance must be positive.");

  const distanceM = v.distance_km !== undefined ? Math.round(v.distance_km * 1000) : null;
  const avgPace = paceSecPerKm(distanceM, v.duration ?? null);

  const runId = insert("runs", {
    session_id: v.session_id ?? null,
    date: v.date,
    type: v.type,
    distance_m: distanceM,
    duration_sec: v.duration ?? null,
    avg_pace_sec: avgPace,
    avg_hr: v.avg_hr ?? null,
    max_hr: v.max_hr ?? null,
    elevation_m: v.elevation_m ?? null,
    rpe: v.rpe ?? null,
    target_distance_m:
      v.target_distance_km !== undefined ? Math.round(v.target_distance_km * 1000) : null,
    target_pace_sec: v.target_pace ?? null,
    notes: v.notes ?? null,
  });

  const records = recordRunPRs(runId, v.date);
  recomputeDayScore(v.date);
  refresh("/body/running", `/body/running/${runId}`);
  return ok({ id: runId, records });
}

export async function updateRun(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(runSchema.partial().extend({ id }), formObject(form));
  if (!parsed.ok) return parsed.result;
  const { id: runId, distance_km, duration, target_distance_km, target_pace, ...rest } = parsed.value;

  const existing = get<{ distance_m: number | null; duration_sec: number | null; date: string }>(
    "SELECT distance_m, duration_sec, date FROM runs WHERE id = ?",
    [runId],
  );
  if (!existing) return fail("Run not found.");

  const distanceM = distance_km !== undefined ? Math.round(distance_km * 1000) : existing.distance_m;
  const durationSec = duration !== undefined ? duration : existing.duration_sec;

  update("runs", runId, {
    ...rest,
    distance_m: distanceM,
    duration_sec: durationSec,
    avg_pace_sec: paceSecPerKm(distanceM, durationSec),
    target_distance_m:
      target_distance_km !== undefined ? Math.round(target_distance_km * 1000) : undefined,
    target_pace_sec: target_pace,
  });
  recomputeDayScore(rest.date ?? existing.date);
  refresh("/body/running", `/body/running/${runId}`);
  return ok();
}

export async function deleteRun(runId: string): Promise<ActionResult> {
  const row = get<{ date: string }>("SELECT date FROM runs WHERE id = ?", [runId]);
  db().prepare("DELETE FROM personal_records WHERE domain = 'RUN' AND source_id = ?").run(runId);
  remove("runs", runId);
  if (row) recomputeDayScore(row.date);
  refresh("/body/running");
  return ok();
}

export async function addRunInterval(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      run_id: id,
      distance_m: optionalNumber,
      duration: timeToSeconds,
      target_pace: timeToSeconds,
      recovery_sec: optionalInt,
      avg_hr: optionalInt,
      notes: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  if (!v.distance_m && !v.duration) return fail("An interval needs a distance or a duration.");

  const nextIndex =
    (get<{ v: number }>(
      "SELECT COALESCE(MAX(interval_index), 0) AS v FROM run_intervals WHERE run_id = ?",
      [v.run_id],
    )?.v ?? 0) + 1;

  insert("run_intervals", {
    run_id: v.run_id,
    interval_index: nextIndex,
    distance_m: v.distance_m ?? null,
    duration_sec: v.duration ?? null,
    pace_sec: paceSecPerKm(v.distance_m ?? null, v.duration ?? null),
    target_pace_sec: v.target_pace ?? null,
    recovery_sec: v.recovery_sec ?? null,
    avg_hr: v.avg_hr ?? null,
    notes: v.notes ?? null,
  });
  refresh(`/body/running/${v.run_id}`);
  return ok();
}

/** Builds an interval set in one action, e.g. 6 × 800m @ 4:30/km. */
export async function buildIntervalSet(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      run_id: id,
      reps: optionalInt,
      distance_m: optionalNumber,
      target_pace: timeToSeconds,
      recovery_sec: optionalInt,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  const reps = v.reps ?? 0;
  if (reps < 1 || reps > 40) return fail("Choose between 1 and 40 intervals.");
  if (!v.distance_m || v.distance_m <= 0) return fail("Set the interval distance.");

  let index =
    get<{ v: number }>(
      "SELECT COALESCE(MAX(interval_index), 0) AS v FROM run_intervals WHERE run_id = ?",
      [v.run_id],
    )?.v ?? 0;

  for (let i = 0; i < reps; i++) {
    index += 1;
    insert("run_intervals", {
      run_id: v.run_id,
      interval_index: index,
      distance_m: v.distance_m,
      duration_sec: null,
      pace_sec: null,
      target_pace_sec: v.target_pace ?? null,
      recovery_sec: v.recovery_sec ?? null,
      avg_hr: null,
      notes: null,
    });
  }
  refresh(`/body/running/${v.run_id}`);
  return ok();
}

export async function updateRunInterval(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id,
      distance_m: optionalNumber,
      duration: timeToSeconds,
      target_pace: timeToSeconds,
      recovery_sec: optionalInt,
      avg_hr: optionalInt,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  const row = get<{ run_id: string; distance_m: number | null; duration_sec: number | null }>(
    "SELECT run_id, distance_m, duration_sec FROM run_intervals WHERE id = ?",
    [v.id],
  );
  if (!row) return fail("Interval not found.");

  const distance = v.distance_m ?? row.distance_m;
  const duration = v.duration ?? row.duration_sec;

  update("run_intervals", v.id, {
    distance_m: distance,
    duration_sec: duration,
    pace_sec: paceSecPerKm(distance, duration),
    target_pace_sec: v.target_pace,
    recovery_sec: v.recovery_sec,
    avg_hr: v.avg_hr,
  });
  refresh(`/body/running/${row.run_id}`);
  return ok();
}

export async function deleteRunInterval(intervalId: string): Promise<ActionResult> {
  const row = get<{ run_id: string }>("SELECT run_id FROM run_intervals WHERE id = ?", [intervalId]);
  remove("run_intervals", intervalId);
  if (row) refresh(`/body/running/${row.run_id}`);
  return ok();
}

/* ------------------------------------------------------------------ HYROX */

export async function createHyroxSession(form: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = parseWith(
    z.object({
      date: dayWithDefault,
      kind: z.enum(["STATION_WORK", "PARTIAL_SIM", "FULL_SIM", "RACE"]).default("STATION_WORK"),
      division: z.enum(["OPEN", "PRO", "DOUBLES"]).default("OPEN"),
      notes: optionalText,
      session_id: optionalText,
      scaffold: checkbox,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  const hyroxId = insert("hyrox_sessions", {
    session_id: v.session_id ?? null,
    date: v.date,
    kind: v.kind,
    division: v.division,
    notes: v.notes ?? null,
  });

  // A full simulation is scaffolded with the standard race sequence so the
  // user only has to fill in times.
  if (v.scaffold || v.kind === "FULL_SIM" || v.kind === "RACE") {
    for (const step of buildRaceSequence()) {
      const defaults = STATION_DEFAULTS[step.station];
      insert("hyrox_stations", {
        hyrox_session_id: hyroxId,
        station: step.station,
        sequence: step.sequence,
        duration_sec: null,
        distance_m: defaults.distance_m ?? null,
        weight_kg: defaults.weight_kg ?? null,
        reps: defaults.reps ?? null,
        pace_sec: null,
        transition_sec: null,
        rpe: null,
        notes: null,
      });
    }
  }

  recomputeDayScore(v.date);
  refresh("/body/hyrox", `/body/hyrox/${hyroxId}`);
  return ok({ id: hyroxId });
}

export async function addHyroxStation(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      hyrox_session_id: id,
      station: z.enum(HYROX_STATIONS),
      duration: timeToSeconds,
      distance_m: optionalNumber,
      weight_kg: optionalNumber,
      reps: optionalInt,
      transition_sec: optionalInt,
      rpe: optionalNumber,
      notes: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  const nextSeq =
    (get<{ v: number }>(
      "SELECT COALESCE(MAX(sequence), 0) AS v FROM hyrox_stations WHERE hyrox_session_id = ?",
      [v.hyrox_session_id],
    )?.v ?? 0) + 1;

  insert("hyrox_stations", {
    hyrox_session_id: v.hyrox_session_id,
    station: v.station,
    sequence: nextSeq,
    duration_sec: v.duration ?? null,
    distance_m: v.distance_m ?? STATION_DEFAULTS[v.station].distance_m ?? null,
    weight_kg: v.weight_kg ?? STATION_DEFAULTS[v.station].weight_kg ?? null,
    reps: v.reps ?? STATION_DEFAULTS[v.station].reps ?? null,
    pace_sec: paceSecPerKm(v.distance_m ?? null, v.duration ?? null),
    transition_sec: v.transition_sec ?? null,
    rpe: v.rpe ?? null,
    notes: v.notes ?? null,
  });
  await recalcHyroxTotals(v.hyrox_session_id);
  refresh(`/body/hyrox/${v.hyrox_session_id}`);
  return ok();
}

export async function updateHyroxStation(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id,
      duration: timeToSeconds,
      distance_m: optionalNumber,
      weight_kg: optionalNumber,
      reps: optionalInt,
      transition_sec: optionalInt,
      rpe: optionalNumber,
      notes: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  const row = get<{ hyrox_session_id: string; distance_m: number | null }>(
    "SELECT hyrox_session_id, distance_m FROM hyrox_stations WHERE id = ?",
    [v.id],
  );
  if (!row) return fail("Station not found.");

  const distance = v.distance_m ?? row.distance_m;
  update("hyrox_stations", v.id, {
    duration_sec: v.duration,
    distance_m: v.distance_m,
    weight_kg: v.weight_kg,
    reps: v.reps,
    pace_sec: paceSecPerKm(distance, v.duration ?? null),
    transition_sec: v.transition_sec,
    rpe: v.rpe,
    notes: v.notes,
  });
  await recalcHyroxTotals(row.hyrox_session_id);
  refresh(`/body/hyrox/${row.hyrox_session_id}`);
  return ok();
}

export async function deleteHyroxStation(stationId: string): Promise<ActionResult> {
  const row = get<{ hyrox_session_id: string }>(
    "SELECT hyrox_session_id FROM hyrox_stations WHERE id = ?",
    [stationId],
  );
  remove("hyrox_stations", stationId);
  if (row) {
    await recalcHyroxTotals(row.hyrox_session_id);
    refresh(`/body/hyrox/${row.hyrox_session_id}`);
  }
  return ok();
}

/** Recomputes run/station/transition totals from the recorded stations. */
export async function recalcHyroxTotals(hyroxSessionId: string): Promise<ActionResult> {
  const stations = all<{ station: string; duration_sec: number | null; transition_sec: number | null }>(
    "SELECT station, duration_sec, transition_sec FROM hyrox_stations WHERE hyrox_session_id = ?",
    [hyroxSessionId],
  );
  const runSec = stations
    .filter((s) => s.station === "RUN")
    .reduce((t, s) => t + (s.duration_sec ?? 0), 0);
  const stationSec = stations
    .filter((s) => s.station !== "RUN")
    .reduce((t, s) => t + (s.duration_sec ?? 0), 0);
  const transitionSec = stations.reduce((t, s) => t + (s.transition_sec ?? 0), 0);
  const anyTimed = stations.some((s) => (s.duration_sec ?? 0) > 0);

  update("hyrox_sessions", hyroxSessionId, {
    run_total_sec: anyTimed ? runSec : null,
    station_total_sec: anyTimed ? stationSec : null,
    transition_sec: transitionSec || null,
    total_sec: anyTimed ? runSec + stationSec + transitionSec : null,
  });
  return ok();
}

export async function completeHyroxSession(
  hyroxSessionId: string,
): Promise<ActionResult<{ records: DetectedRecord[] }>> {
  const row = get<{ date: string }>("SELECT date FROM hyrox_sessions WHERE id = ?", [
    hyroxSessionId,
  ]);
  if (!row) return fail("HYROX session not found.");
  await recalcHyroxTotals(hyroxSessionId);
  const records = recordHyroxPRs(hyroxSessionId, row.date);
  recomputeDayScore(row.date);
  refresh("/body/hyrox", `/body/hyrox/${hyroxSessionId}`);
  return ok({ records });
}

export async function deleteHyroxSession(hyroxSessionId: string): Promise<ActionResult> {
  const row = get<{ date: string }>("SELECT date FROM hyrox_sessions WHERE id = ?", [
    hyroxSessionId,
  ]);
  db()
    .prepare("DELETE FROM personal_records WHERE domain = 'HYROX' AND source_id = ?")
    .run(hyroxSessionId);
  remove("hyrox_sessions", hyroxSessionId);
  if (row) recomputeDayScore(row.date);
  refresh("/body/hyrox");
  return ok();
}

/* -------------------------------------------------------------- NUTRITION */

function ensureNutritionLog(date: string): NutritionLog {
  const existing = get<NutritionLog>("SELECT * FROM nutrition_logs WHERE date = ?", [date]);
  if (existing) return existing;
  insert("nutrition_logs", { date });
  return get<NutritionLog>("SELECT * FROM nutrition_logs WHERE date = ?", [date])!;
}

function recalcNutritionLog(date: string) {
  const row = get<{
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
  }>(
    `SELECT COALESCE(SUM(calories), 0) AS calories, COALESCE(SUM(protein_g), 0) AS protein_g,
            COALESCE(SUM(carbs_g), 0) AS carbs_g, COALESCE(SUM(fat_g), 0) AS fat_g,
            COALESCE(SUM(fiber_g), 0) AS fiber_g
       FROM meals WHERE date = ?`,
    [date],
  );
  const log = ensureNutritionLog(date);
  update("nutrition_logs", log.id, {
    calories: Math.round(row?.calories ?? 0),
    protein_g: row?.protein_g ?? 0,
    carbs_g: row?.carbs_g ?? 0,
    fat_g: row?.fat_g ?? 0,
    fiber_g: row?.fiber_g ?? 0,
  });
}

const mealSchema = z.object({
  date: dayWithDefault,
  name: requiredText,
  slot: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK", "MEAL", "SHAKE"]).default("MEAL"),
  calories: optionalInt,
  protein_g: optionalNumber,
  carbs_g: optionalNumber,
  fat_g: optionalNumber,
  fiber_g: optionalNumber,
  save_preset: checkbox,
});

export async function logMeal(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(mealSchema, formObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  const values = {
    calories: v.calories ?? 0,
    protein_g: v.protein_g ?? 0,
    carbs_g: v.carbs_g ?? 0,
    fat_g: v.fat_g ?? 0,
    fiber_g: v.fiber_g ?? 0,
  };
  if (Object.values(values).every((n) => n === 0)) {
    return fail("Enter at least one macro or a calorie figure.");
  }
  if (Object.values(values).some((n) => n < 0)) return fail("Values cannot be negative.");

  const log = ensureNutritionLog(v.date);
  insert("meals", {
    nutrition_log_id: log.id,
    date: v.date,
    name: v.name,
    slot: v.slot,
    ...values,
    logged_at: nowIso(),
  });

  if (v.save_preset) {
    const existing = get<{ id: string; use_count: number }>(
      "SELECT id, use_count FROM meal_presets WHERE name = ?",
      [v.name],
    );
    if (existing) update("meal_presets", existing.id, { ...values, use_count: existing.use_count + 1 });
    else insert("meal_presets", { name: v.name, slot: v.slot, ...values, use_count: 1 });
  }

  recalcNutritionLog(v.date);
  recomputeDayScore(v.date);
  refresh("/body/nutrition");
  return ok();
}

export async function logMealPreset(presetId: string, date: string): Promise<ActionResult> {
  const preset = get<{
    name: string;
    slot: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    use_count: number;
  }>("SELECT * FROM meal_presets WHERE id = ?", [presetId]);
  if (!preset) return fail("Preset not found.");

  const form = new FormData();
  form.set("date", date);
  form.set("name", preset.name);
  form.set("slot", preset.slot);
  form.set("calories", String(preset.calories));
  form.set("protein_g", String(preset.protein_g));
  form.set("carbs_g", String(preset.carbs_g));
  form.set("fat_g", String(preset.fat_g));
  form.set("fiber_g", String(preset.fiber_g));
  update("meal_presets", presetId, { use_count: preset.use_count + 1 });
  return logMeal(form);
}

export async function deleteMeal(mealId: string): Promise<ActionResult> {
  const row = get<{ date: string }>("SELECT date FROM meals WHERE id = ?", [mealId]);
  remove("meals", mealId);
  if (row) {
    recalcNutritionLog(row.date);
    recomputeDayScore(row.date);
  }
  refresh("/body/nutrition");
  return ok();
}

export async function logWater(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({ date: dayWithDefault, water_ml: optionalInt }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  if (v.water_ml === undefined || v.water_ml < 0) return fail("Enter a water amount in millilitres.");
  const log = ensureNutritionLog(v.date);
  update("nutrition_logs", log.id, { water_ml: (log.water_ml ?? 0) + v.water_ml });
  refresh("/body/nutrition");
  return ok();
}

export async function setNutritionTarget(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      effective_from: dayWithDefault,
      goal: z.enum(["MUSCLE_GAIN", "MAINTENANCE", "FAT_LOSS", "HYBRID"]).default("HYBRID"),
      calories: optionalInt,
      protein_g: optionalInt,
      carbs_g: optionalInt,
      fat_g: optionalInt,
      fiber_g: optionalInt,
      water_ml: optionalInt,
      weight_trend_kg_per_week: optionalNumber,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  if (!v.calories || v.calories <= 0) return fail("Set a calorie target above zero.");
  if (!v.protein_g || v.protein_g <= 0) return fail("Set a protein target above zero.");

  const existing = get<{ id: string }>("SELECT id FROM nutrition_targets WHERE effective_from = ?", [
    v.effective_from,
  ]);
  const values = {
    effective_from: v.effective_from,
    goal: v.goal,
    calories: v.calories,
    protein_g: v.protein_g,
    carbs_g: v.carbs_g ?? 0,
    fat_g: v.fat_g ?? 0,
    fiber_g: v.fiber_g ?? null,
    water_ml: v.water_ml ?? null,
    weight_trend_kg_per_week: v.weight_trend_kg_per_week ?? null,
  };
  if (existing) update("nutrition_targets", existing.id, values);
  else insert("nutrition_targets", values);

  recomputeDayScore(today());
  refresh("/body/nutrition");
  return ok();
}

/* ----------------------------------------------------------- MEASUREMENTS */

export async function logMeasurement(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      date: dayWithDefault,
      weight_kg: optionalNumber,
      waist_cm: optionalNumber,
      chest_cm: optionalNumber,
      arm_cm: optionalNumber,
      shoulder_cm: optionalNumber,
      thigh_cm: optionalNumber,
      hip_cm: optionalNumber,
      neck_cm: optionalNumber,
      body_fat_pct: optionalNumber,
      photo_note: optionalText,
      notes: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const { date, ...rest } = parsed.value;

  if (Object.values(rest).every((v) => v === undefined)) {
    return fail("Enter at least one measurement.");
  }
  if (rest.weight_kg !== undefined && (rest.weight_kg <= 20 || rest.weight_kg >= 400)) {
    return fail("Weight looks wrong — enter a value in kilograms.");
  }
  if (rest.body_fat_pct !== undefined && (rest.body_fat_pct < 1 || rest.body_fat_pct > 70)) {
    return fail("Body fat percentage must be between 1 and 70.");
  }

  const existing = get<{ id: string }>("SELECT id FROM body_measurements WHERE date = ?", [date]);
  if (existing) update("body_measurements", existing.id, rest);
  else insert("body_measurements", { date, ...rest });

  recomputeDayScore(date);
  refresh("/body/measurements");
  return ok();
}

export async function deleteMeasurement(measurementId: string): Promise<ActionResult> {
  remove("body_measurements", measurementId);
  refresh("/body/measurements");
  return ok();
}

/* --------------------------------------------------------------- RECOVERY */

export async function logRecovery(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      date: dayWithDefault,
      sleep_hours: optionalNumber,
      sleep_quality: optionalInt,
      energy: optionalInt,
      stress: optionalInt,
      soreness: optionalInt,
      motivation: optionalInt,
      resting_hr: optionalInt,
      is_rest_day: checkbox,
      notes: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const { date, is_rest_day, ...rest } = parsed.value;

  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined) continue;
    if (["sleep_quality", "energy", "stress", "soreness", "motivation"].includes(key)) {
      if (typeof value === "number" && (value < 1 || value > 5)) {
        return fail(`${key.replace(/_/g, " ")} must be between 1 and 5.`);
      }
    }
  }
  if (rest.sleep_hours !== undefined && (rest.sleep_hours < 0 || rest.sleep_hours > 24)) {
    return fail("Sleep hours must be between 0 and 24.");
  }

  const existing = get<{ id: string }>("SELECT id FROM recovery_logs WHERE date = ?", [date]);
  const values = { ...rest, is_rest_day: is_rest_day ? 1 : 0 };
  if (existing) update("recovery_logs", existing.id, values);
  else insert("recovery_logs", { date, ...values });

  recomputeDayScore(date);
  refresh("/body/recovery");
  return ok();
}

/* ------------------------------------------------------------- QUICK LOG */

export async function quickLogWeight(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({ weight_kg: optionalNumber, date: optionalDay }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  if (parsed.value.weight_kg === undefined) return fail("Enter a weight.");

  const next = new FormData();
  next.set("weight_kg", String(parsed.value.weight_kg));
  next.set("date", parsed.value.date ?? today());
  return logMeasurement(next);
}
