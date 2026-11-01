import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

export type Db = Database;

const schemaSql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

/**
 * Opens a SQLite database and applies the idempotent schema.
 * Pass ":memory:" in tests to get an isolated database.
 */
export function openDatabase(path: string): Db {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path, { create: true });
  db.exec("PRAGMA foreign_keys = ON;");
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec(schemaSql);
  return db;
}
