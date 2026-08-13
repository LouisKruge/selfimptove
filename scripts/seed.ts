/**
 * Seeds COMMAND with its starting structure.
 *
 *   npm run seed            — create the starting state if the database is empty
 *   npm run seed -- --force — rewrite the structure even if data exists
 *   npm run reset           — delete the database and start again
 *   npm run seed -- --demo  — additionally generate a labelled demo history
 *
 * Structure only by default: objectives, season, mission, milestones, habits,
 * skills, exercise catalogue and workout templates. No training, revenue or
 * financial history is invented — those must come from the user.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../src/lib/db/schema.generated";
import { applyMigrations } from "../src/lib/db/migrations";
import {
  EXERCISES,
  GOALS,
  HABITS,
  MEAL_PRESETS,
  MILESTONES,
  MISSION_KPIS,
  NUTRITION_TARGET,
  SETTINGS,
  SKILLS,
  WORKOUTS,
} from "./seed-data";
import { generateDemo } from "./demo";

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const RESET = args.has("--reset");
const DEMO = args.has("--demo");

const DB_PATH = resolve(process.env.COMMAND_DB_PATH ?? "data/command.db");

if (RESET) {
  for (const suffix of ["", "-wal", "-shm"]) {
    const path = `${DB_PATH}${suffix}`;
    if (existsSync(path)) rmSync(path);
  }
  console.log(`· removed ${DB_PATH}`);
}

// A fresh clone has no data directory — the database file cannot be created
// inside one that does not exist.
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA_SQL);
applyMigrations(db);

const now = () => new Date().toISOString();
const id = () => randomUUID();

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function insert(table: string, values: Record<string, unknown>): string {
  const rowId = (values.id as string) ?? id();
  const ts = now();
  const row = { id: rowId, created_at: ts, updated_at: ts, ...values, id_: undefined };
  delete (row as Record<string, unknown>).id_;
  const cols = Object.keys(row).filter((k) => row[k as keyof typeof row] !== undefined);
  db.prepare(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
  ).run(...cols.map((c) => normalise((row as Record<string, unknown>)[c])));
  return rowId;
}

function normalise(v: unknown) {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return v as string | number;
}

function count(table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS v FROM ${table}`).get() as { v: number }).v;
}

/* ------------------------------------------------------------------ guard */

/**
 * Scores are derived, never stored by hand — so after seeding we ask the real
 * scoring engine to compute them, exactly as the running app would.
 */
async function rebuildScores(windowDays: number) {
  db.close();
  process.env.COMMAND_DB_PATH = DB_PATH;
  const { recomputeDayScore } = await import("../src/lib/services/scores");
  const today = todayString();
  for (let i = windowDays - 1; i >= 0; i--) recomputeDayScore(addDays(today, -i));
  console.log(`  scores      recomputed for ${windowDays} days`);
}

const alreadySeeded = count("users") > 0;
if (alreadySeeded && !FORCE) {
  console.log("COMMAND is already set up. Nothing changed.");
  console.log("  · npm run seed -- --force   rewrite the starting structure");
  console.log("  · npm run reset             delete the database and start over");
  if (DEMO) {
    console.log("\nGenerating demo history on the existing database…");
    console.log(generateDemo(db));
    void rebuildScores(75);
  } else {
    db.close();
  }
} else {
  seedStructure();
}

function seedStructure() {
const today = todayString();

db.transaction(() => {
  /* --------------------------------------------------------------- user */
  let userId = (db.prepare("SELECT id FROM users LIMIT 1").get() as { id: string } | undefined)?.id;
  if (!userId) {
    userId = insert("users", {
      name: "Operator",
      timezone: process.env.COMMAND_TZ ?? "Africa/Johannesburg",
      currency: "ZAR",
      locale: "en-ZA",
      life_vision:
        "Build a life with financial freedom, physical capability, strong relationships, personal discipline, meaningful work and control over time.",
    });
  }

  /* ----------------------------------------------------------- settings */
  const upsertSetting = db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  );
  for (const [key, value] of SETTINGS) upsertSetting.run(key, value, now());

  /* ------------------------------------------------------------- season */
  let seasonId = (
    db.prepare("SELECT id FROM seasons WHERE name = 'FOUNDATION'").get() as { id: string } | undefined
  )?.id;
  if (!seasonId) {
    seasonId = insert("seasons", {
      name: "FOUNDATION",
      objective:
        "Build the person, systems, body, business and financial structure capable of long-term compounding.",
      why: "Everything compounds off a foundation or collapses without one.",
      start_date: today,
      end_date: addDays(today, 179),
      status: "ACTIVE",
      weight_body: 25,
      weight_business: 30,
      weight_character: 25,
      weight_finance: 10,
      weight_learning: 10,
    });
  }

  /* -------------------------------------------------------------- goals */
  const goalIds = new Map<string, string>();
  for (const goal of GOALS) {
    const existing = db.prepare("SELECT id FROM goals WHERE title = ?").get(goal.title) as
      | { id: string }
      | undefined;
    if (existing) {
      goalIds.set(goal.key, existing.id);
      continue;
    }
    const goalId = insert("goals", {
      parent_id: goal.parent ? (goalIds.get(goal.parent) ?? null) : null,
      horizon: goal.horizon,
      pillar: goal.pillar,
      title: goal.title,
      why: goal.why,
      kpi: goal.kpi ?? null,
      unit: goal.unit ?? null,
      start_value: goal.current ?? null,
      current_value: goal.current ?? null,
      target_value: goal.target ?? null,
      direction: goal.direction ?? "UP",
      status: "ACTIVE",
      sort_order: GOALS.indexOf(goal),
    });
    goalIds.set(goal.key, goalId);
  }

  /* ------------------------------------------------------------ mission */
  let missionId = (
    db.prepare("SELECT id FROM missions WHERE title = 'BUILD THE MACHINE'").get() as
      | { id: string }
      | undefined
  )?.id;
  if (!missionId) {
    missionId = insert("missions", {
      season_id: seasonId,
      goal_id: goalIds.get("revenue-1y") ?? null,
      title: "BUILD THE MACHINE",
      objective:
        "Build a functioning, validated, revenue-producing business with a clear target customer, a clear offer, a working product, a lead-generation system, a sales process, first paying customers and a repeatable acquisition process.",
      why: "One working business changes every other number in this system.",
      kind: "PRIMARY",
      start_date: today,
      end_date: addDays(today, 89),
      target_value: 30000,
      current_value: 0,
      unit: "ZAR monthly revenue",
      status: "ACTIVE",
    });

    MILESTONES.forEach((m, i) => {
      insert("milestones", {
        mission_id: missionId,
        title: m.title,
        description: m.description,
        target_date: addDays(today, Math.round(((i + 1) / MILESTONES.length) * 89)),
        sort_order: i,
        weight: 1,
        status: "PENDING",
      });
    });

    for (const kpi of MISSION_KPIS) {
      insert("mission_kpis", {
        mission_id: missionId,
        name: kpi.name,
        unit: kpi.unit,
        current_value: kpi.current,
        target_value: kpi.target,
      });
    }
  }

  /* ----------------------------------------------------------- business */
  if (count("businesses") === 0) {
    insert("businesses", {
      name: "The Machine",
      model: "To be defined during the Research and Offer milestones.",
      stage: "VALIDATE",
      target_customer: null,
      offer: null,
      avg_deal_cents: null,
      mrr_target_cents: 3_000_000,
    });
  }

  /* ---------------------------------------------------------- exercises */
  const exerciseIds = new Map<string, string>();
  for (const ex of EXERCISES) {
    const existing = db.prepare("SELECT id FROM exercises WHERE name = ?").get(ex.name) as
      | { id: string }
      | undefined;
    if (existing) {
      exerciseIds.set(ex.name, existing.id);
      continue;
    }
    exerciseIds.set(
      ex.name,
      insert("exercises", {
        name: ex.name,
        category: ex.category,
        modality: ex.modality,
        muscle_group: ex.muscle_group,
        is_compound: ex.is_compound ? 1 : 0,
        default_rest_sec: ex.rest ?? (ex.is_compound ? 150 : 75),
        progression_rule: ex.progression ?? "DOUBLE_PROGRESSION",
        increment_kg: ex.increment ?? 2.5,
        archived: 0,
      }),
    );
  }

  /* ----------------------------------------------------------- workouts */
  for (const w of WORKOUTS) {
    const existing = db.prepare("SELECT id FROM workouts WHERE name = ?").get(w.name) as
      | { id: string }
      | undefined;
    if (existing) continue;
    const workoutId = insert("workouts", {
      name: w.name,
      type: w.type,
      focus: w.focus,
      description: w.description,
      est_minutes: w.est_minutes,
      archived: 0,
    });
    w.exercises.forEach((e, i) => {
      const exerciseId = exerciseIds.get(e.name);
      if (!exerciseId) return;
      insert("workout_exercises", {
        workout_id: workoutId,
        exercise_id: exerciseId,
        sort_order: i,
        target_sets: e.sets,
        rep_min: e.repMin ?? null,
        rep_max: e.repMax ?? null,
        target_seconds: e.seconds ?? null,
        target_distance_m: e.distanceM ?? null,
        target_pace_sec: e.paceSec ?? null,
        target_rir_min: e.rirMin ?? null,
        target_rir_max: e.rirMax ?? null,
        rest_sec: e.rest ?? null,
        notes: e.notes ?? null,
      });
    });
  }

  /* ---------------------------------------------------------- nutrition */
  if (count("nutrition_targets") === 0) {
    insert("nutrition_targets", { effective_from: today, ...NUTRITION_TARGET });
  }
  if (count("meal_presets") === 0) {
    for (const preset of MEAL_PRESETS) insert("meal_presets", { ...preset, use_count: 0 });
  }

  /* ------------------------------------------------------------- habits */
  if (count("habits") === 0) {
    HABITS.forEach((h, i) => {
      insert("habits", {
        name: h.name,
        pillar: h.pillar,
        description: h.description,
        target_per_week: h.target,
        sort_order: i,
        active: 1,
      });
    });
  }

  /* ------------------------------------------------------------- skills */
  if (count("skills") === 0) {
    for (const s of SKILLS) {
      insert("skills", {
        name: s.name,
        why: s.why,
        current_level: s.current,
        target_level: s.target,
        active: 1,
      });
    }
  }
})();

console.log("COMMAND is set up.");
console.log(`  season      FOUNDATION`);
console.log(`  mission     BUILD THE MACHINE (${today} → ${addDays(today, 89)})`);
console.log(`  goals       ${count("goals")}`);
console.log(`  milestones  ${count("milestones")}`);
console.log(`  exercises   ${count("exercises")}`);
console.log(`  workouts    ${count("workouts")}`);
console.log(`  habits      ${count("habits")}`);
console.log(`  skills      ${count("skills")}`);
console.log("");
console.log("No history has been invented. Scores, trends and records start the");
console.log("moment you log something real.");

if (DEMO) {
  console.log("\nGenerating demo history…");
  console.log(generateDemo(db));
  void rebuildScores(75);
} else {
  void rebuildScores(1);
}
}
