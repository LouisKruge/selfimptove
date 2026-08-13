/**
 * Container entrypoint.
 *
 * A hosted COMMAND has no terminal to run `npm run seed` in, so first boot has
 * to set itself up. This checks whether the database on the mounted disk has
 * ever been seeded and, only if it has not, creates the starting structure —
 * the season, mission, goals, exercises, workouts, habits and skills.
 *
 * It never touches an existing database. On every boot after the first this
 * does nothing but hand over to the server, so a restart or redeploy cannot
 * overwrite real logged history.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

const dbPath = resolve(process.env.COMMAND_DB_PATH ?? "data/command.db");
mkdirSync(dirname(dbPath), { recursive: true });

/** Has this database ever been seeded? Opened read-only so the check cannot create it. */
function needsSeeding() {
  if (!existsSync(dbPath)) return true;

  const db = new Database(dbPath, { readonly: true });
  try {
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
      .get();
    if (!table) return true;
    return db.prepare("SELECT COUNT(*) AS v FROM users").get().v === 0;
  } catch {
    // An unreadable file is not an empty one. Refuse to seed over it and let
    // the server surface the real error rather than destroying data.
    return false;
  } finally {
    db.close();
  }
}

if (needsSeeding()) {
  console.log(`· first boot — creating the starting structure at ${dbPath}`);
  const seed = spawnSync("npm", ["run", "seed"], { stdio: "inherit", env: process.env });
  if (seed.status !== 0) {
    console.error("· seeding failed — refusing to start with no structure");
    process.exit(1);
  }
} else {
  console.log(`· database found at ${dbPath} — leaving it untouched`);
}

if (!process.env.COMMAND_PASSWORD?.trim()) {
  console.warn("· COMMAND_PASSWORD is not set — every route will refuse until it is");
}

const port = process.env.PORT ?? "3000";
const server = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", port], { stdio: "inherit" });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code) => process.exit(code ?? 0));
