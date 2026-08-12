import type { Database } from "better-sqlite3";

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
];

export function applyMigrations(db: Database): void {
  for (const m of COLUMNS) {
    if (!tableExists(db, m.table)) continue;
    if (columnExists(db, m.table, m.column)) continue;
    db.exec(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.definition}`);
  }
}

function tableExists(db: Database, table: string): boolean {
  return (
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table) !== undefined
  );
}

function columnExists(db: Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}
