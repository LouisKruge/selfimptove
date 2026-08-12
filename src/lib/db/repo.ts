import "server-only";

import { db } from "./index";
import { newId } from "@/lib/core/ids";
import { nowIso } from "@/lib/core/date";

/**
 * Thin insert/update helpers so every table does not need hand-written SQL for
 * the same shape of operation. Column names are always supplied by our own
 * code, never by user input.
 */

const IDENT = /^[a-z_][a-z0-9_]*$/;

function assertIdent(name: string) {
  if (!IDENT.test(name)) throw new Error(`Unsafe identifier: ${name}`);
}

export function insert<T extends Record<string, unknown>>(
  table: string,
  values: T,
  opts: { id?: string; timestamps?: boolean } = {},
): string {
  assertIdent(table);
  const id = opts.id ?? (values.id as string | undefined) ?? newId();
  const ts = nowIso();

  const row: Record<string, unknown> = { id, ...values };
  if (opts.timestamps !== false) {
    row.created_at = row.created_at ?? ts;
    row.updated_at = ts;
  }

  const cols = Object.keys(row).filter((k) => row[k] !== undefined);
  for (const c of cols) assertIdent(c);

  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols
    .map(() => "?")
    .join(", ")})`;
  db()
    .prepare(sql)
    .run(...cols.map((c) => normalise(row[c])));
  return id;
}

export function update(
  table: string,
  id: string,
  values: Record<string, unknown>,
  opts: { timestamps?: boolean } = {},
): void {
  assertIdent(table);
  const row: Record<string, unknown> = { ...values };
  if (opts.timestamps !== false) row.updated_at = nowIso();

  const cols = Object.keys(row).filter((k) => row[k] !== undefined && k !== "id");
  if (cols.length === 0) return;
  for (const c of cols) assertIdent(c);

  const sql = `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`;
  db()
    .prepare(sql)
    .run(...cols.map((c) => normalise(row[c])), id);
}

export function upsertByColumn<T extends Record<string, unknown>>(
  table: string,
  column: string,
  value: string,
  values: T,
): string {
  assertIdent(table);
  assertIdent(column);
  const existing = db()
    .prepare(`SELECT id FROM ${table} WHERE ${column} = ?`)
    .get(value) as { id: string } | undefined;
  if (existing) {
    update(table, existing.id, values);
    return existing.id;
  }
  return insert(table, { ...values, [column]: value } as Record<string, unknown>);
}

export function remove(table: string, id: string): void {
  assertIdent(table);
  db().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
}

export function byId<T>(table: string, id: string): T | undefined {
  assertIdent(table);
  return db().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as T | undefined;
}

/** SQLite has no boolean type; undefined is dropped before this is reached. */
function normalise(v: unknown): string | number | null | Buffer {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number" || typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return JSON.stringify(v);
}
