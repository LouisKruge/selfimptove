import "server-only";

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { SCHEMA_SQL } from "./schema.generated";
import { applyMigrations } from "./migrations";

export type DB = Database.Database;

const globalForDb = globalThis as unknown as { __commandDb?: DB };

function resolveDbPath(): string {
  const configured = process.env.COMMAND_DB_PATH;
  if (configured && configured.trim().length > 0) return resolve(configured);
  return resolve(process.cwd(), "data", "command.db");
}

function open(): DB {
  const path = resolveDbPath();
  mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA_SQL);
  applyMigrations(db);
  return db;
}

/**
 * Single shared connection. Cached on globalThis so Next's dev-server module
 * reloading does not leak file handles.
 */
export function db(): DB {
  if (!globalForDb.__commandDb) globalForDb.__commandDb = open();
  return globalForDb.__commandDb;
}

/** Opens a connection at an explicit path (used by scripts and tests). */
export function openDatabaseAt(path: string): DB {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  const conn = new Database(resolve(path));
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.exec(SCHEMA_SQL);
  applyMigrations(conn);
  return conn;
}

/* ---------------------------------------------------------------- helpers */

export function all<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): T[] {
  return db().prepare(sql).all(...(params as never[])) as T[];
}

export function get<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): T | undefined {
  return db().prepare(sql).get(...(params as never[])) as T | undefined;
}

export function run(sql: string, params: unknown[] = []) {
  return db().prepare(sql).run(...(params as never[]));
}

export function transact<T>(fn: (conn: DB) => T): T {
  const conn = db();
  return conn.transaction(fn)(conn);
}

/** Scalar query returning a number, defaulting to 0 for NULL/absent rows. */
export function scalar(sql: string, params: unknown[] = []): number {
  const row = get<{ v: number | null }>(sql, params);
  return row?.v ?? 0;
}
