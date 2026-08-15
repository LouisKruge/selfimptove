import "server-only";

import { createClient, type Client, type InValue, type ResultSet } from "@libsql/client";
import { SCHEMA_SQL } from "./schema.generated";
import { applyMigrations } from "./migrations";

/**
 * Storage.
 *
 * COMMAND speaks SQLite, and libSQL lets the same SQL run against two very
 * different places without changing a query:
 *
 *   · a local file, which is what you want on your own machine
 *   · a hosted libSQL database, which is what you need when the app runs
 *     somewhere with no durable filesystem of its own
 *
 * Set `TURSO_DATABASE_URL` and it uses the hosted database. Leave it unset and
 * it uses `COMMAND_DB_PATH`, defaulting to `data/command.db`. Nothing else in
 * the codebase knows or cares which one it got.
 *
 * Every helper here is async, because a database reached over a network cannot
 * be read in the same tick the way a local file can.
 */

export type DB = Client;

const globalForDb = globalThis as unknown as { __commandDb?: Promise<Client> };

function createConnection(): Client {
  const url = process.env.TURSO_DATABASE_URL?.trim();

  if (url) {
    return createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
      // Counts and cents are read as JavaScript numbers, not bigints, so the
      // arithmetic in the domain engines behaves exactly as it always has.
      intMode: "number",
    });
  }

  // Local file. Deliberately no filesystem calls here: passing a runtime value
  // to fs or path makes the bundler trace the entire project into the server
  // bundle, and this branch never runs on the hosted deployment anyway. The
  // directory is created by whichever script creates the database — seed,
  // populate or boot — so by the time the app opens it, it exists.
  const path = process.env.COMMAND_DB_PATH ?? "data/command.db";
  return createClient({ url: `file:${path}`, intMode: "number" });
}

/**
 * Opens the connection and brings the schema up to date exactly once per
 * process. The promise itself is cached, so concurrent first requests all wait
 * on the same setup rather than racing to create the same tables.
 */
/**
 * A cheap fingerprint of the schema.
 *
 * Applying the whole schema costs a large round trip, and on serverless that
 * would be paid on every cold start. Checking for one known table was enough to
 * skip it — until the schema gained a table that an existing database had never
 * seen, which that check would have missed forever. The fingerprint changes
 * whenever schema.sql does, so new tables and new columns both land.
 */
function schemaFingerprint(): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < SCHEMA_SQL.length; i++) {
    h ^= SCHEMA_SQL.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${SCHEMA_SQL.length.toString(36)}.${h.toString(36)}`;
}

async function connect(): Promise<Client> {
  const client = createConnection();
  await client.execute("PRAGMA foreign_keys = ON");

  const fingerprint = schemaFingerprint();

  let applied: string | null = null;
  try {
    const row = await client.execute(
      "SELECT value FROM settings WHERE key = 'schema_fingerprint'",
    );
    applied = row.rows.length > 0 ? String(row.rows[0][0]) : null;
  } catch {
    // No settings table yet — this database has never been provisioned.
    applied = null;
  }

  if (applied !== fingerprint) {
    await client.executeMultiple(SCHEMA_SQL);
    await applyMigrations(client);
    await client.execute({
      sql: `INSERT INTO settings (key, value, updated_at) VALUES ('schema_fingerprint', ?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [fingerprint, new Date().toISOString()],
    });
  }

  return client;
}

export function db(): Promise<Client> {
  if (!globalForDb.__commandDb) globalForDb.__commandDb = connect();
  return globalForDb.__commandDb;
}

/** Drops the cached connection. Used by tests between throwaway databases. */
export async function closeDatabase(): Promise<void> {
  const pending = globalForDb.__commandDb;
  globalForDb.__commandDb = undefined;
  if (!pending) return;
  try {
    (await pending).close();
  } catch {
    /* already closed */
  }
}

/* ---------------------------------------------------------------- helpers */

/**
 * libSQL returns rows that behave like both arrays and objects. Everything
 * downstream expects plain objects it can spread and destructure, so rows are
 * rebuilt against the column list.
 */
function toRows<T>(result: ResultSet): T[] {
  return result.rows.map((row) => {
    const object: Record<string, unknown> = {};
    result.columns.forEach((column, index) => {
      object[column] = row[index];
    });
    return object as T;
  });
}

/** `undefined` is not a value a parameter can carry; it always means SQL NULL. */
function toArgs(params: unknown[]): InValue[] {
  return params.map((p) => (p === undefined ? null : (p as InValue)));
}

export async function all<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = await db();
  return toRows<T>(await client.execute({ sql, args: toArgs(params) }));
}

export async function get<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await all<T>(sql, params);
  return rows[0];
}

export async function run(sql: string, params: unknown[] = []): Promise<void> {
  const client = await db();
  await client.execute({ sql, args: toArgs(params) });
}

/**
 * Runs several statements as one transaction.
 *
 * Used where a set of writes has to land together — renumbering set indices,
 * for instance, where a half-applied sequence would leave gaps or duplicates.
 */
export async function batch(
  statements: ReadonlyArray<{ sql: string; params?: unknown[] }>,
): Promise<void> {
  if (statements.length === 0) return;
  const client = await db();
  await client.batch(
    statements.map((s) => ({ sql: s.sql, args: toArgs(s.params ?? []) })),
    "write",
  );
}

/** Scalar query returning a number, defaulting to 0 for NULL/absent rows. */
export async function scalar(sql: string, params: unknown[] = []): Promise<number> {
  const row = await get<{ v: number | null }>(sql, params);
  return row?.v ?? 0;
}
