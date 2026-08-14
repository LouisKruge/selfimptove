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
import { createClient, type Client } from "@libsql/client";
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

/**
 * Seeds whichever database COMMAND is configured to use: the hosted one when
 * TURSO_DATABASE_URL is set, otherwise a local file. First boot on a host runs
 * this against the hosted database, which is why it cannot assume a filesystem.
 */
const REMOTE_URL = process.env.TURSO_DATABASE_URL?.trim();

if (RESET) {
  if (REMOTE_URL) {
    // Deleting a hosted database is not something a seed script should do on a
    // flag. Dropping it is a deliberate act, done where it can be confirmed.
    console.error("· --reset only applies to a local database file.");
    console.error("  TURSO_DATABASE_URL is set, so nothing was deleted.");
    console.error("  Drop and recreate the database from your Turso dashboard instead.");
    process.exit(1);
  }
  for (const suffix of ["", "-wal", "-shm"]) {
    const path = `${DB_PATH}${suffix}`;
    if (existsSync(path)) rmSync(path);
  }
  console.log(`· removed ${DB_PATH}`);
}

// A fresh clone has no data directory — the database file cannot be created
// inside one that does not exist.
if (!REMOTE_URL) mkdirSync(dirname(DB_PATH), { recursive: true });

const db: Client = REMOTE_URL
  ? createClient({ url: REMOTE_URL, authToken: process.env.TURSO_AUTH_TOKEN?.trim(), intMode: "number" })
  : createClient({ url: `file:${DB_PATH}`, intMode: "number" });

await db.execute("PRAGMA foreign_keys = ON");
await db.executeMultiple(SCHEMA_SQL);
await applyMigrations(db);

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

async function insert(table: string, values: Record<string, unknown>): Promise<string> {
  const rowId = (values.id as string) ?? id();
  const ts = now();
  const row = { id: rowId, created_at: ts, updated_at: ts, ...values, id_: undefined };
  delete (row as Record<string, unknown>).id_;
  const cols = Object.keys(row).filter((k) => row[k as keyof typeof row] !== undefined);
  await db.execute({
    sql: `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
    args: cols.map((c) => normalise((row as Record<string, unknown>)[c])),
  });
  return rowId;
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

/** Single-row query, mirroring the shape the old synchronous driver returned. */
async function one<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return rowsOf<T>(await db.execute({ sql, args: params as never[] }))[0];
}

function normalise(v: unknown) {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return v as string | number;
}

async function count(table: string): Promise<number> {
  return (await one<{ v: number }>(`SELECT COUNT(*) AS v FROM ${table}`))?.v ?? 0;
}

/* ------------------------------------------------------------------ guard */

/**
 * Scores are derived, never stored by hand — so after seeding we ask the real
 * scoring engine to compute them, exactly as the running app would.
 */
async function rebuildScores(windowDays: number) {
  db.close();
  if (!REMOTE_URL) process.env.COMMAND_DB_PATH = DB_PATH;
  const { recomputeDayScore } = await import("../src/lib/services/scores");
  const today = todayString();
  for (let i = windowDays - 1; i >= 0; i--) await recomputeDayScore(addDays(today, -i));
  console.log(`  scores      recomputed for ${windowDays} days`);
}

const alreadySeeded = await count("users") > 0;
if (alreadySeeded && !FORCE) {
  console.log("COMMAND is already set up. Nothing changed.");
  console.log("  · npm run seed -- --force   rewrite the starting structure");
  console.log("  · npm run reset             delete the database and start over");
  if (DEMO) {
    console.log("\nGenerating demo history on the existing database…");
    console.log(await generateDemo(db));
    await rebuildScores(75);
  } else {
    db.close();
  }
} else {
  await seedStructure();
}

async function seedStructure() {
const today = todayString();

await (async () => {
  /* --------------------------------------------------------------- user */
  let userId = (await one<{ id: string }>("SELECT id FROM users LIMIT 1"))?.id;
  if (!userId) {
    userId = await insert("users", {
          name: "Operator",
          timezone: process.env.COMMAND_TZ ?? "Africa/Johannesburg",
          currency: "ZAR",
          locale: "en-ZA",
          life_vision:
            "Build a life with financial freedom, physical capability, strong relationships, personal discipline, meaningful work and control over time.",
        });
  }

  /* ----------------------------------------------------------- settings */
  for (const [key, value] of SETTINGS) {
    await db.execute({
      sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [key, value, now()],
    });
  }

  /* ------------------------------------------------------------- season */
  let seasonId = (
    await one<{ id: string }>("SELECT id FROM seasons WHERE name = 'FOUNDATION'")
  )?.id;
  if (!seasonId) {
    seasonId = await insert("seasons", {
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
    const existing = await one<{ id: string }>("SELECT id FROM goals WHERE title = ?", [goal.title]);
    if (existing) {
      goalIds.set(goal.key, existing.id);
      continue;
    }
    const goalId = await insert("goals", {
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
    await one<{ id: string }>("SELECT id FROM missions WHERE title = 'BUILD THE MACHINE'")
  )?.id;
  if (!missionId) {
    missionId = await insert("missions", {
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

    for (const [i, m] of MILESTONES.entries()) {
      await insert("milestones", {
        mission_id: missionId,
        title: m.title,
        description: m.description,
        target_date: addDays(today, Math.round(((i + 1) / MILESTONES.length) * 89)),
        sort_order: i,
        weight: 1,
        status: "PENDING",
      });
    }

    for (const kpi of MISSION_KPIS) {
      await insert("mission_kpis", {
                mission_id: missionId,
                name: kpi.name,
                unit: kpi.unit,
                current_value: kpi.current,
                target_value: kpi.target,
              });
    }
  }

  /* ----------------------------------------------------------- business */
  if (await count("businesses") === 0) {
    await insert("businesses", {
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
    const existing = await one<{ id: string }>("SELECT id FROM exercises WHERE name = ?", [ex.name]);
    if (existing) {
      exerciseIds.set(ex.name, existing.id);
      continue;
    }
    exerciseIds.set(
      ex.name,
      await insert("exercises", {
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
    const existing = await one<{ id: string }>("SELECT id FROM workouts WHERE name = ?", [w.name]);
    if (existing) continue;
    const workoutId = await insert("workouts", {
          name: w.name,
          type: w.type,
          focus: w.focus,
          description: w.description,
          est_minutes: w.est_minutes,
          archived: 0,
        });
    for (const [i, e] of w.exercises.entries()) {
      const exerciseId = exerciseIds.get(e.name);
      if (!exerciseId) continue;
      await insert("workout_exercises", {
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
    }
  }

  /* ---------------------------------------------------------- nutrition */
  if (await count("nutrition_targets") === 0) {
    await insert("nutrition_targets", { effective_from: today, ...NUTRITION_TARGET });
  }
  if (await count("meal_presets") === 0) {
    for (const preset of MEAL_PRESETS) await insert("meal_presets", { ...preset, use_count: 0 });
  }

  /* ------------------------------------------------------------- habits */
  if (await count("habits") === 0) {
    for (const [i, h] of HABITS.entries()) {
      await insert("habits", {
        name: h.name,
        pillar: h.pillar,
        description: h.description,
        target_per_week: h.target,
        sort_order: i,
        active: 1,
      });
    }
  }

  /* ------------------------------------------------------------- skills */
  if (await count("skills") === 0) {
    for (const s of SKILLS) {
      await insert("skills", {
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
console.log(`  goals       ${await count("goals")}`);
console.log(`  milestones  ${await count("milestones")}`);
console.log(`  exercises   ${await count("exercises")}`);
console.log(`  workouts    ${await count("workouts")}`);
console.log(`  habits      ${await count("habits")}`);
console.log(`  skills      ${await count("skills")}`);
console.log("");
console.log("No history has been invented. Scores, trends and records start the");
console.log("moment you log something real.");

if (DEMO) {
  console.log("\nGenerating demo history…");
  console.log(await generateDemo(db));
  await rebuildScores(75);
} else {
  await rebuildScores(1);
}
}
