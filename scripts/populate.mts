/**
 * Applies Stefan's COMMAND configuration to whichever database is configured.
 *
 *   npm run populate        — local database
 *   (automatically on deploy when TURSO_DATABASE_URL is set)
 *
 * This is a reconciler, not a seed. It runs on every deploy and is safe to run
 * repeatedly:
 *
 *   · structure it owns (goals, missions, workouts, habits, skills, ideas,
 *     nutrition targets, business KPIs) is matched to the configuration
 *   · structure it does not recognise is ARCHIVED, never deleted
 *   · anything logged — sets, runs, meals, measurements, leads, revenue,
 *     promises, reviews — is never touched
 *
 * It writes no measurements. Strength, HYROX, body composition, cash, debt,
 * investments, revenue and customer counts are left unset so the interface can
 * report them as unrecorded rather than as zero.
 */

import { createClient, type Client, type InValue } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { SCHEMA_SQL } from "../src/lib/db/schema.generated";
import { applyMigrations } from "../src/lib/db/migrations";
import {
  BASELINE_WORKOUTS,
  BUSINESS,
  BUSINESS_KPIS,
  DISCIPLINE_NOTE,
  EXERCISES,
  FINANCE_NOTE,
  GOALS,
  HABITS,
  IDEAS,
  MEAL_PRESETS,
  MILESTONES,
  NUTRITION_RULES,
  NUTRITION_TARGET,
  OPENING_TASKS,
  PILLAR_MISSIONS,
  PRIMARY_MISSION,
  PRIMARY_MISSION_KPIS,
  PROFILE,
  REVENUE_MILESTONES,
  REVIEW_NOTE,
  SALES_ACTIVITY,
  SEASON,
  SETTINGS,
  SKILLS,
  STRATEGY_NOTE,
  WORKOUTS,
} from "./command-data";
import { MUST_WIN_CONFLICTS, NEXUS_PROJECT, NEXUS_TASKS } from "./nexus-tasks";

/* ------------------------------------------------------------- connection */

const REMOTE_URL = process.env.TURSO_DATABASE_URL?.trim();
const DB_PATH = resolve(process.env.COMMAND_DB_PATH ?? "data/command.db");
if (!REMOTE_URL) mkdirSync(dirname(DB_PATH), { recursive: true });

const db: Client = REMOTE_URL
  ? createClient({
      url: REMOTE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
      intMode: "number",
    })
  : createClient({ url: `file:${DB_PATH}`, intMode: "number" });

await db.execute("PRAGMA foreign_keys = ON");
await db.executeMultiple(SCHEMA_SQL);
await applyMigrations(db);

/* ---------------------------------------------------------------- helpers */

const now = () => new Date().toISOString();
const uid = () => randomUUID();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function args(values: unknown[]): InValue[] {
  return values.map((v) => {
    if (v === undefined || v === null) return null;
    if (typeof v === "boolean") return v ? 1 : 0;
    return v as InValue;
  });
}

function rowsOf<T>(result: { rows: unknown[]; columns: string[] }): T[] {
  return result.rows.map((row) => {
    const object: Record<string, unknown> = {};
    result.columns.forEach((column, index) => {
      object[column] = (row as unknown[])[index];
    });
    return object as T;
  });
}

async function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return rowsOf<T>(await db.execute({ sql, args: args(params) }));
}

async function one<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await all<T>(sql, params))[0];
}

async function run(sql: string, params: unknown[] = []): Promise<void> {
  await db.execute({ sql, args: args(params) });
}

/**
 * Several statements in one round trip.
 *
 * Against a hosted database every statement is a network call, and rebuilding
 * the workout prescriptions alone is ninety-four of them. Batching turns the
 * whole rebuild into one call per workout.
 */
async function batch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
  if (statements.length === 0) return;
  await db.batch(
    statements.map((s) => ({ sql: s.sql, args: args(s.params ?? []) })),
    "write",
  );
}

async function insert(table: string, values: Record<string, unknown>): Promise<string> {
  const id = (values.id as string) ?? uid();
  const ts = now();
  const row = { id, created_at: ts, updated_at: ts, ...values };
  const cols = Object.keys(row).filter((k) => row[k as keyof typeof row] !== undefined);
  await run(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
    cols.map((c) => (row as Record<string, unknown>)[c]),
  );
  return id;
}

async function update(table: string, id: string, values: Record<string, unknown>): Promise<void> {
  const cols = Object.keys(values).filter((k) => values[k] !== undefined);
  if (cols.length === 0) return;
  await run(
    `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
    [...cols.map((c) => values[c]), now(), id],
  );
}

/**
 * Insert if absent, update if present. Returns the row id either way.
 *
 * `onInsert` is applied only when the row is created. Start dates live there:
 * a season or mission that is already running must keep the date it began on,
 * however many times this reconciler runs afterwards.
 */
async function upsert(
  table: string,
  matchColumn: string,
  matchValue: string,
  values: Record<string, unknown>,
  onInsert: Record<string, unknown> = {},
): Promise<string> {
  const existing = await one<{ id: string }>(
    `SELECT id FROM ${table} WHERE ${matchColumn} = ?`,
    [matchValue],
  );
  if (existing) {
    await update(table, existing.id, values);
    return existing.id;
  }
  return insert(table, { ...values, ...onInsert, [matchColumn]: matchValue });
}

const counts = { created: 0, updated: 0, archived: 0 };
const log = (line: string) => console.log(`  ${line}`);

/* ----------------------------------------------------------------- profile */

const userId =
  (await one<{ id: string }>("SELECT id FROM users LIMIT 1"))?.id ??
  (await insert("users", { name: PROFILE.name }));

await update("users", userId, {
  name: PROFILE.name,
  timezone: PROFILE.timezone,
  currency: PROFILE.currency,
  locale: PROFILE.locale,
  life_vision: PROFILE.northStar,
});
log(`profile      ${PROFILE.name} · ${PROFILE.currency} · ${PROFILE.timezone}`);

for (const [key, value] of SETTINGS) {
  await run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, now()],
  );
}
log(`settings     ${SETTINGS.length} keys`);

/* ------------------------------------------------------------------ season */

const start = today();
const seasonId = await upsert("seasons", "name", SEASON.name, {
  objective: SEASON.objective,
  why: SEASON.why,
  status: "ACTIVE",
  weight_body: SEASON.weights.body,
  weight_business: SEASON.weights.business,
  weight_character: SEASON.weights.character,
  weight_finance: SEASON.weights.finance,
  weight_learning: SEASON.weights.learning,
}, { start_date: start, end_date: addDays(start, 179) });
log(
  `season       ${SEASON.name} · ${SEASON.weights.body}/${SEASON.weights.business}/${SEASON.weights.character}/${SEASON.weights.finance}/${SEASON.weights.learning}`,
);

/* ------------------------------------------------------------------- goals */

const goalIds = new Map<string, string>();
for (const goal of GOALS) {
  const id = await upsert("goals", "title", goal.title, {
    parent_id: goal.parent ? (goalIds.get(goal.parent) ?? null) : null,
    horizon: goal.horizon,
    pillar: goal.pillar,
    why: goal.why ?? null,
    kpi: goal.kpi ?? null,
    unit: goal.unit ?? null,
    start_value: goal.start ?? null,
    current_value: goal.current ?? null,
    target_value: goal.target ?? null,
    direction: goal.direction ?? "UP",
    status: "ACTIVE",
    next_action: goal.nextAction ?? null,
    sort_order: GOALS.indexOf(goal),
  });
  goalIds.set(goal.key, id);
}

// Anything left over came from the generic starting structure.
const keptGoalTitles = new Set(GOALS.map((g) => g.title));
for (const row of await all<{ id: string; title: string }>(
  "SELECT id, title FROM goals WHERE status = 'ACTIVE'",
)) {
  if (keptGoalTitles.has(row.title)) continue;
  await update("goals", row.id, { status: "ARCHIVED" });
  counts.archived++;
}
log(`goals        ${GOALS.length} active`);

/* ---------------------------------------------------------------- missions */

const missionEnd = addDays(start, 89);

const primaryId = await upsert("missions", "title", PRIMARY_MISSION.title, {
  season_id: seasonId,
  goal_id: goalIds.get(PRIMARY_MISSION.goalKey) ?? null,
  objective: PRIMARY_MISSION.objective,
  why: PRIMARY_MISSION.why,
  kind: "PRIMARY",
  status: "ACTIVE",
  target_value: PRIMARY_MISSION.targetValue,
  unit: PRIMARY_MISSION.unit,
}, { start_date: start, end_date: missionEnd });

// Milestones: replace the set, but keep any that are already under way.
const existingMilestones = await all<{ id: string; title: string; status: string }>(
  "SELECT id, title, status FROM milestones WHERE mission_id = ?",
  [primaryId],
);
const wanted = new Set(MILESTONES.map((m) => m.title));
for (const m of existingMilestones) {
  if (!wanted.has(m.title) && m.status === "PENDING") {
    await run("DELETE FROM milestones WHERE id = ?", [m.id]);
  }
}
for (const [i, m] of MILESTONES.entries()) {
  await upsert("milestones", "title", m.title, {
    mission_id: primaryId,
    description: m.description,
    target_date: addDays(start, Math.round(((i + 1) / MILESTONES.length) * 89)),
    sort_order: i,
    weight: 1,
  });
}

for (const kpi of PRIMARY_MISSION_KPIS) {
  const existing = await one<{ id: string }>(
    "SELECT id FROM mission_kpis WHERE mission_id = ? AND name = ?",
    [primaryId, kpi.name],
  );
  if (existing) {
    await update("mission_kpis", existing.id, { unit: kpi.unit, target_value: kpi.target });
  } else {
    await insert("mission_kpis", {
      mission_id: primaryId,
      name: kpi.name,
      unit: kpi.unit,
      target_value: kpi.target,
      current_value: null,
    });
  }
}

for (const mission of PILLAR_MISSIONS) {
  const id = await upsert("missions", "title", mission.title, {
    season_id: seasonId,
    goal_id: goalIds.get(mission.goalKey) ?? null,
    objective: mission.objective,
    why: mission.why,
    kind: "SECONDARY",
    status: "ACTIVE",
  }, { start_date: start, end_date: missionEnd });
  for (const kpi of mission.kpis) {
    const existing = await one<{ id: string }>(
      "SELECT id FROM mission_kpis WHERE mission_id = ? AND name = ?",
      [id, kpi.name],
    );
    if (existing) {
      await update("mission_kpis", existing.id, { unit: kpi.unit, target_value: kpi.target });
    } else {
      await insert("mission_kpis", {
        mission_id: id,
        name: kpi.name,
        unit: kpi.unit,
        target_value: kpi.target,
        current_value: "current" in kpi ? (kpi.current ?? null) : null,
      });
    }
  }
}
log(`missions     1 primary · ${PILLAR_MISSIONS.length} pillar · ${MILESTONES.length} milestones`);

/* --------------------------------------------------------------- exercises */

const exerciseIds = new Map<string, string>();
for (const ex of EXERCISES) {
  const id = await upsert("exercises", "name", ex.name, {
    category: ex.category,
    modality: ex.modality,
    muscle_group: ex.muscle_group,
    is_compound: ex.is_compound ? 1 : 0,
    default_rest_sec: ex.rest ?? (ex.is_compound ? 150 : 75),
    progression_rule: ex.progression ?? "DOUBLE_PROGRESSION",
    increment_kg: ex.increment ?? 2.5,
    archived: 0,
  });
  exerciseIds.set(ex.name, id);
}

// A focused catalogue. Anything from the generic starting set is archived, not
// deleted — an archived exercise keeps any history that was logged against it.
const keptExercises = new Set(EXERCISES.map((e) => e.name));
for (const row of await all<{ id: string; name: string }>(
  "SELECT id, name FROM exercises WHERE archived = 0",
)) {
  if (keptExercises.has(row.name)) continue;
  await update("exercises", row.id, { archived: 1 });
  counts.archived++;
}
log(`exercises    ${EXERCISES.length}`);

/* ---------------------------------------------------------------- workouts */

const allWorkouts = [...WORKOUTS, ...BASELINE_WORKOUTS];

for (const w of allWorkouts) {
  const workoutId = await upsert("workouts", "name", w.name, {
    type: w.type,
    focus: w.focus,
    description: w.description,
    est_minutes: w.est_minutes,
    archived: 0,
  });

  // The prescription is owned by this file — rebuild it so edits here land.
  // One transaction per workout: the old rows never disappear without the new
  // ones arriving, even if the connection drops mid-way.
  const cols = [
    "id", "workout_id", "exercise_id", "sort_order", "target_sets", "rep_min", "rep_max",
    "target_seconds", "target_distance_m", "target_rir_min", "target_rir_max", "rest_sec",
    "notes", "created_at", "updated_at",
  ];
  const ts = now();
  const statements: Array<{ sql: string; params?: unknown[] }> = [
    { sql: "DELETE FROM workout_exercises WHERE workout_id = ?", params: [workoutId] },
  ];
  for (const [i, e] of w.exercises.entries()) {
    const exerciseId = exerciseIds.get(e.name);
    if (!exerciseId) continue;
    statements.push({
      sql: `INSERT INTO workout_exercises (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      params: [
        uid(), workoutId, exerciseId, i, e.sets, e.repMin ?? null, e.repMax ?? null,
        e.seconds ?? null, e.distanceM ?? null, e.rirMin ?? null, e.rirMax ?? null,
        e.rest ?? null, e.notes ?? null, ts, ts,
      ],
    });
  }
  await batch(statements);
}

const keptWorkouts = new Set(allWorkouts.map((w) => w.name));
for (const row of await all<{ id: string; name: string }>(
  "SELECT id, name FROM workouts WHERE archived = 0",
)) {
  if (keptWorkouts.has(row.name)) continue;
  await update("workouts", row.id, { archived: 1 });
  counts.archived++;
}
log(`workouts     ${WORKOUTS.length} weekly · ${BASELINE_WORKOUTS.length} baseline`);

/* --------------------------------------------------------------- nutrition */

const existingTarget = await one<{ id: string }>(
  "SELECT id FROM nutrition_targets ORDER BY effective_from DESC LIMIT 1",
);
if (existingTarget) {
  await update("nutrition_targets", existingTarget.id, NUTRITION_TARGET);
} else {
  await insert("nutrition_targets", { effective_from: start, ...NUTRITION_TARGET });
}

for (const preset of MEAL_PRESETS) {
  const { name, ...macros } = preset;
  // use_count is the operator's history, not configuration — never reset it.
  await upsert("meal_presets", "name", name, macros);
}
log(
  `nutrition    ${NUTRITION_TARGET.calories} kcal · ${NUTRITION_TARGET.protein_g}P / ${NUTRITION_TARGET.carbs_g}C / ${NUTRITION_TARGET.fat_g}F`,
);

/* ------------------------------------------------------- bodyweight (real) */

/**
 * The one body measurement that exists. Recorded only if nothing is on file for
 * today, so a real weigh-in is never overwritten by a redeploy.
 */
const measuredToday = await one<{ id: string }>(
  "SELECT id FROM body_measurements WHERE date = ?",
  [start],
);
const anyMeasurement = await one<{ id: string }>("SELECT id FROM body_measurements LIMIT 1");
if (!measuredToday && !anyMeasurement) {
  await insert("body_measurements", {
    date: start,
    weight_kg: PROFILE.bodyweightKg,
    notes: "Starting bodyweight. Waist, chest, arms and thighs still to be recorded.",
  });
  log(`bodyweight   ${PROFILE.bodyweightKg} kg recorded`);
}

/* ------------------------------------------------------------------ habits */

for (const [i, h] of HABITS.entries()) {
  await upsert("habits", "name", h.name, {
    pillar: h.pillar,
    description: h.description,
    target_per_week: h.target,
    sort_order: i,
    active: 1,
  });
}
const keptHabits = new Set(HABITS.map((h) => h.name));
for (const row of await all<{ id: string; name: string }>(
  "SELECT id, name FROM habits WHERE active = 1",
)) {
  if (keptHabits.has(row.name)) continue;
  await update("habits", row.id, { active: 0 });
  counts.archived++;
}
log(`habits       ${HABITS.length}`);

/* ------------------------------------------------------------------ skills */

for (const s of SKILLS) {
  await upsert("skills", "name", s.name, {
    why: s.why,
    current_level: s.current,
    target_level: s.target,
    active: 1,
  });
}
const keptSkills = new Set(SKILLS.map((s) => s.name));
for (const row of await all<{ id: string; name: string }>(
  "SELECT id, name FROM skills WHERE active = 1",
)) {
  if (keptSkills.has(row.name)) continue;
  await update("skills", row.id, { active: 0 });
  counts.archived++;
}
log(`skills       ${SKILLS.length}`);

/* ------------------------------------------------------------------- ideas */

for (const idea of IDEAS) {
  await upsert("ideas", "title", idea.title, {
    summary: idea.summary,
    stage: idea.stage,
    research_notes: `NEXT TEST: ${idea.nextTest}`,
  });
}
log(`ideas        ${IDEAS.length} in the vault`);

/* ---------------------------------------------------------------- business */

const businessId = await upsert("businesses", "name", BUSINESS.name, {
  model: BUSINESS.model,
  stage: BUSINESS.stage,
  mrr_target_cents: BUSINESS.mrrTargetCents,
});

for (const [i, kpi] of BUSINESS_KPIS.entries()) {
  const existing = await one<{ id: string }>(
    "SELECT id FROM business_kpis WHERE business_id = ? AND name = ?",
    [businessId, kpi.name],
  );
  if (existing) {
    await update("business_kpis", existing.id, { unit: kpi.unit, target_value: kpi.target, sort_order: i });
  } else {
    await insert("business_kpis", {
      business_id: businessId,
      name: kpi.name,
      unit: kpi.unit,
      target_value: kpi.target,
      sort_order: i,
    });
  }
}

// Revenue milestones as goals under the business long-term goal.
for (const [i, amount] of REVENUE_MILESTONES.entries()) {
  const title = `Revenue milestone — R${amount.toLocaleString("en-ZA")}/month`;
  await upsert("goals", "title", title, {
    parent_id: goalIds.get("business-long") ?? null,
    horizon: "ONE_YEAR",
    pillar: "BUSINESS",
    why: "Milestones make a large target into a sequence that can actually be attacked.",
    kpi: "Monthly revenue",
    unit: "ZAR",
    target_value: amount,
    current_value: null,
    direction: "UP",
    status: "ACTIVE",
    sort_order: 100 + i,
  });
}
log(`business     R${BUSINESS.mrrTargetCents / 100 / 1000}k target · ${BUSINESS_KPIS.length} KPIs · ${REVENUE_MILESTONES.length} milestones`);

/* ---------------------------------------------------------------- projects */

const projectId = await upsert("projects", "title", NEXUS_PROJECT.title, {
  mission_id: primaryId,
  goal_id: goalIds.get("business-long") ?? null,
  business_id: businessId,
  pillar: "BUSINESS",
  objective: NEXUS_PROJECT.objective,
  expected_outcome: NEXUS_PROJECT.expectedOutcome,
  status: "ACTIVE",
  next_action: NEXUS_PROJECT.nextAction,
  deadline: NEXUS_TASKS[NEXUS_TASKS.length - 1].deadline,
});

// COMMAND itself is built and running — it is no longer the business project.
const commandProject = await one<{ id: string; status: string }>(
  "SELECT id, status FROM projects WHERE title = ?",
  ["COMMAND — Business Operating System"],
);
if (commandProject && commandProject.status === "ACTIVE") {
  await update("projects", commandProject.id, { status: "COMPLETE", completed_at: now() });
}

// Only one primary business project may be ACTIVE.
for (const row of await all<{ id: string; title: string }>(
  "SELECT id, title FROM projects WHERE status = 'ACTIVE' AND pillar = 'BUSINESS'",
)) {
  if (row.id === projectId) continue;
  await update("projects", row.id, { status: "PLANNED" });
  counts.archived++;
}

// The idea this project came out of is now active, not sitting in the vault.
const nexusIdea = await one<{ id: string }>("SELECT id FROM ideas WHERE title = ?", [
  NEXUS_PROJECT.ideaTitle,
]);
if (nexusIdea) {
  await update("ideas", nexusIdea.id, {
    stage: "ACTIVE",
    promoted_project_id: projectId,
    activated_at: now(),
  });
}
log(`projects     NEXUS active · COMMAND complete`);

/* -------------------------------------------------------------- NEXUS plan */

/**
 * Sixty tasks across thirteen phases. Updated in place so a change to the plan
 * lands on the next deploy, but a task already COMPLETE or CANCELLED is left
 * exactly as the operator left it — the plan never resurrects finished work.
 */
let nexusCreated = 0;
let nexusUpdated = 0;
let nexusUntouched = 0;

for (const task of NEXUS_TASKS) {
  const existing = await one<{ id: string; status: string }>(
    "SELECT id, status FROM tasks WHERE title = ?",
    [task.title],
  );

  const fields = {
    project_id: projectId,
    mission_id: primaryId,
    goal_id: goalIds.get("business-long") ?? null,
    pillar: "BUSINESS",
    description: task.phase,
    expected_outcome: task.expected,
    priority: task.priority,
    scheduled_date: task.scheduled,
    deadline: task.deadline,
    estimated_minutes: task.minutes,
    sort_order: task.n,
  };

  if (!existing) {
    await insert("tasks", { ...fields, title: task.title, status: "TODO" });
    nexusCreated++;
  } else if (existing.status === "COMPLETE" || existing.status === "CANCELLED") {
    nexusUntouched++;
  } else {
    await update("tasks", existing.id, fields);
    nexusUpdated++;
  }
}

log(
  `NEXUS plan   ${NEXUS_TASKS.length} tasks · ${nexusCreated} created · ${nexusUpdated} updated · ${nexusUntouched} left alone`,
);
for (const c of MUST_WIN_CONFLICTS) {
  log(`             ${c.date}: task ${String(c.demoted).padStart(2, "0")} scheduled as SUPPORT — task ${String(c.kept).padStart(2, "0")} is the day's must-win`);
}

/* ------------------------------------------------------------------- tasks */

const milestoneIds = new Map(
  (await all<{ id: string; title: string }>("SELECT id, title FROM milestones WHERE mission_id = ?", [
    primaryId,
  ])).map((m) => [m.title, m.id]),
);
void milestoneIds;

for (const [i, task] of OPENING_TASKS.entries()) {
  const existing = await one<{ id: string }>("SELECT id FROM tasks WHERE title = ?", [task.title]);
  if (existing) continue; // never re-open a task the operator has already dealt with
  await insert("tasks", {
    project_id: task.pillar === "BUSINESS" ? projectId : null,
    mission_id: primaryId,
    goal_id: null,
    pillar: task.pillar,
    title: task.title,
    expected_outcome: task.expected_outcome,
    priority: task.priority,
    scheduled_date: start,
    estimated_minutes: task.estimated_minutes,
    status: "TODO",
    sort_order: i,
  });
  counts.created++;
}
log(`tasks        ${OPENING_TASKS.length} opening (1 must-win)`);

/* ------------------------------------------------------------------- notes */

const NOTES: Array<[string, string, string | null]> = [
  ["Nutrition system", NUTRITION_RULES, "BODY"],
  ["Sales activity targets", SALES_ACTIVITY, "BUSINESS"],
  ["Business strategy", STRATEGY_NOTE, "BUSINESS"],
  ["Financial framework", FINANCE_NOTE, "FINANCE"],
  ["Discipline system", DISCIPLINE_NOTE, "CHARACTER"],
  ["Review system", REVIEW_NOTE, "CHARACTER"],
];

for (const [title, body, pillar] of NOTES) {
  const existing = await one<{ id: string }>("SELECT id FROM notes WHERE title = ?", [title]);
  if (existing) await update("notes", existing.id, { body, pillar });
  else await insert("notes", { title, body, pillar });
}
log(`notes        ${NOTES.length} system documents`);

/* ------------------------------------------------------------------- score */

db.close();
if (!REMOTE_URL) process.env.COMMAND_DB_PATH = DB_PATH;
const { recomputeDayScore } = await import("../src/lib/services/scores");
await recomputeDayScore(start);

console.log("");
console.log("COMMAND is configured.");
console.log(`  ${counts.archived} generic items archived (nothing deleted).`);
console.log("");
console.log("NOT RECORDED — these need a baseline before they can be tracked:");
console.log("  strength · HYROX · body measurements · cash · debt");
console.log("  investments · net worth · revenue · MRR · customers");
console.log("");
console.log("Nothing has been invented. Every number above is a target you set.");
