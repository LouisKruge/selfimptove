/**
 * Post-build hook.
 *
 * On a host with no terminal, there is nowhere to run `npm run seed`. The build
 * is the one moment where the project's environment variables are available and
 * a Node process is running, so that is where a hosted database gets its
 * starting structure.
 *
 * The seed is idempotent — it checks for an existing user and stops if it finds
 * one — so this runs harmlessly on every deploy and only does work the first
 * time.
 *
 * Skipped entirely when TURSO_DATABASE_URL is unset, because a local build has
 * a terminal and should not be quietly writing to a database file.
 */

import { spawnSync } from "node:child_process";

if (!process.env.TURSO_DATABASE_URL?.trim()) {
  console.log("· no hosted database configured — skipping seed");
  process.exit(0);
}

console.log("· hosted database configured — ensuring the starting structure exists");

const result = spawnSync(
  "npx",
  ["tsx", "--conditions=react-server", "scripts/seed.mts"],
  { stdio: "inherit", env: process.env },
);

if (result.status !== 0) {
  console.error("· seeding failed");
  process.exit(1);
}
