import type { Client } from "@libsql/client";

/**
 * Additive migrations.
 *
 * `schema.sql` uses CREATE TABLE IF NOT EXISTS, which creates new tables but
 * cannot add a column to a table that already exists. Anything added to an
 * existing table after the first release must also be listed here so databases
 * with real data in them pick it up.
 *
 * These are deliberately additive only — COMMAND never drops a user's column.
 */

interface ColumnMigration {
  table: string;
  column: string;
  /** The column definition, without the name. */
  definition: string;
}

const COLUMNS: ColumnMigration[] = [
  { table: "tasks", column: "delegated_to", definition: "TEXT" },
  { table: "lead_stage_events", column: "updated_at", definition: "TEXT" },
  { table: "tasks", column: "result", definition: "TEXT" },
];

export async function applyMigrations(db: Client): Promise<void> {
  for (const m of COLUMNS) {
    if (!(await tableExists(db, m.table))) continue;
    if (await columnExists(db, m.table, m.column)) continue;
    await db.execute(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.definition}`);
  }
}

async function tableExists(db: Client, table: string): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [table],
  });
  return result.rows.length > 0;
}

async function columnExists(db: Client, table: string, column: string): Promise<boolean> {
  const result = await db.execute(`PRAGMA table_info(${table})`);
  const nameIndex = result.columns.indexOf("name");
  return result.rows.some((row) => row[nameIndex] === column);
}
