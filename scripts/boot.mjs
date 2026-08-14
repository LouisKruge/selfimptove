/**
 * Container entrypoint.
 *
 * A hosted COMMAND has no terminal to run `npm run seed` in, so first boot has
 * to set itself up. This checks whether the configured database has ever been
 * seeded and, only if it has not, creates the starting structure — the season,
 * mission, goals, exercises, workouts, habits and skills.
 *
 * It never touches an existing database. On every boot after the first this
 * does nothing but hand over to the server, so a restart or redeploy cannot
 * overwrite real logged history.
 *
 * Only needed on hosts that run a long-lived container. On serverless the app
 * creates its own schema on first request instead.
 */

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@libsql/client";

const remoteUrl = process.env.TURSO_DATABASE_URL?.trim();
const dbPath = resolve(process.env.COMMAND_DB_PATH ?? "data/command.db");

if (!remoteUrl) mkdirSync(dirname(dbPath), { recursive: true });

const client = remoteUrl
  ? createClient({ url: remoteUrl, authToken: process.env.TURSO_AUTH_TOKEN?.trim() })
  : createClient({ url: `file:${dbPath}` });

const target = remoteUrl ? "the hosted database" : dbPath;

/** Has this database ever been seeded? */
async function needsSeeding() {
  try {
    const table = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'",
    );
    if (table.rows.length === 0) return true;
    const count = await client.execute("SELECT COUNT(*) AS v FROM users");
    return Number(count.rows[0][0]) === 0;
  } catch (error) {
    // An unreachable or unreadable database is not an empty one. Refuse to seed
    // over it and let the failure surface rather than destroying data.
    console.error(`· could not inspect ${target}: ${error.message}`);
    return false;
  }
}

if (await needsSeeding()) {
  console.log(`· first boot — creating the starting structure in ${target}`);
  const seed = spawnSync("npm", ["run", "seed"], { stdio: "inherit", env: process.env });
  if (seed.status !== 0) {
    console.error("· seeding failed — refusing to start with no structure");
    process.exit(1);
  }
} else {
  console.log(`· database found at ${target} — leaving it untouched`);
}

client.close();

if (!process.env.COMMAND_PASSWORD?.trim()) {
  console.warn("· COMMAND_PASSWORD is not set — every route will refuse until it is");
}

const port = process.env.PORT ?? "3000";
const server = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", port], { stdio: "inherit" });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code) => process.exit(code ?? 0));
