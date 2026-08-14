import "server-only";

import { all, scalar } from "@/lib/db";

/**
 * What is actually in the database this server is talking to?
 *
 * When a hosted deployment looks empty there are only two possibilities: the
 * configuration never landed, or it landed somewhere else. Guessing between
 * them from the outside is slow, so the app reports it directly — counts as the
 * running server sees them, and which database produced them.
 *
 * Credentials never appear here. Only the host, which is enough to tell two
 * databases apart.
 */

export interface StoreCount {
  label: string;
  count: number;
  /** Structure comes from the configuration; logged data comes from the operator. */
  kind: "STRUCTURE" | "LOGGED";
}

export interface Diagnostics {
  /** "hosted · <host>" or "local file · <path>". Never includes a token. */
  source: string;
  hosted: boolean;
  counts: StoreCount[];
  structureTotal: number;
  loggedTotal: number;
}

function describeSource(): { source: string; hosted: boolean } {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) {
    return {
      source: `local file · ${process.env.COMMAND_DB_PATH ?? "data/command.db"}`,
      hosted: false,
    };
  }
  // Strip any credentials before showing it.
  let host = url;
  try {
    host = new URL(url).host || url;
  } catch {
    /* keep the raw value if it will not parse */
  }
  return { source: `hosted · ${host}`, hosted: true };
}

const STRUCTURE: Array<[string, string]> = [
  ["Goals", "SELECT COUNT(*) AS v FROM goals WHERE status = 'ACTIVE'"],
  ["Missions", "SELECT COUNT(*) AS v FROM missions WHERE status = 'ACTIVE'"],
  ["Milestones", "SELECT COUNT(*) AS v FROM milestones"],
  ["Mission KPIs", "SELECT COUNT(*) AS v FROM mission_kpis"],
  ["Workouts", "SELECT COUNT(*) AS v FROM workouts WHERE archived = 0"],
  ["Prescribed exercises", "SELECT COUNT(*) AS v FROM workout_exercises"],
  ["Exercise catalogue", "SELECT COUNT(*) AS v FROM exercises WHERE archived = 0"],
  ["Habits", "SELECT COUNT(*) AS v FROM habits WHERE active = 1"],
  ["Skills", "SELECT COUNT(*) AS v FROM skills WHERE active = 1"],
  ["Ideas", "SELECT COUNT(*) AS v FROM ideas"],
  ["Projects", "SELECT COUNT(*) AS v FROM projects WHERE status = 'ACTIVE'"],
  ["Open tasks", "SELECT COUNT(*) AS v FROM tasks WHERE status <> 'COMPLETE'"],
  ["System notes", "SELECT COUNT(*) AS v FROM notes"],
  ["Nutrition targets", "SELECT COUNT(*) AS v FROM nutrition_targets"],
];

const LOGGED: Array<[string, string]> = [
  ["Training sessions", "SELECT COUNT(*) AS v FROM workout_sessions"],
  ["Sets logged", "SELECT COUNT(*) AS v FROM workout_sets"],
  ["Runs", "SELECT COUNT(*) AS v FROM runs"],
  ["HYROX sessions", "SELECT COUNT(*) AS v FROM hyrox_sessions"],
  ["Body measurements", "SELECT COUNT(*) AS v FROM body_measurements"],
  ["Meals", "SELECT COUNT(*) AS v FROM meals"],
  ["Leads", "SELECT COUNT(*) AS v FROM leads"],
  ["Revenue entries", "SELECT COUNT(*) AS v FROM revenue_entries"],
  ["Accounts", "SELECT COUNT(*) AS v FROM accounts"],
  ["Debts", "SELECT COUNT(*) AS v FROM debts"],
  ["Habit check-ins", "SELECT COUNT(*) AS v FROM habit_logs"],
  ["Reviews", "SELECT COUNT(*) AS v FROM reviews"],
];

export async function diagnostics(): Promise<Diagnostics> {
  const { source, hosted } = describeSource();

  const counts: StoreCount[] = [];
  let structureTotal = 0;
  let loggedTotal = 0;

  for (const [label, sql] of STRUCTURE) {
    const count = await scalar(sql);
    structureTotal += count;
    counts.push({ label, count, kind: "STRUCTURE" });
  }
  for (const [label, sql] of LOGGED) {
    const count = await scalar(sql);
    loggedTotal += count;
    counts.push({ label, count, kind: "LOGGED" });
  }

  return { source, hosted, counts, structureTotal, loggedTotal };
}

/** The workout week as the server sees it — the fastest check that config landed. */
export async function configuredWorkouts(): Promise<Array<{ name: string; exercises: number }>> {
  return all<{ name: string; exercises: number }>(
    `SELECT w.name AS name, COUNT(we.id) AS exercises
       FROM workouts w
       LEFT JOIN workout_exercises we ON we.workout_id = w.id
      WHERE w.archived = 0
      GROUP BY w.id
      ORDER BY w.name`,
  );
}
