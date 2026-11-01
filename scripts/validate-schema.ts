import { Parser } from "@dbml/core";
import { resolve } from "node:path";

const file = resolve(import.meta.dir, "../schema/taskline.dbml");
const dbml = await Bun.file(file).text();

type ParsedDatabase = {
  schemas: Array<{
    name: string;
    tables: Array<{ name: string; fields: unknown[] }>;
    enums: Array<{ name: string }>;
    refs: Array<{ endpoints: unknown[] }>;
  }>;
};

let database: ParsedDatabase;
try {
  database = new Parser().parse(dbml, "dbmlv2") as unknown as ParsedDatabase;
} catch (error) {
  console.error(`✗ Could not parse ${file}`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const schema = database.schemas[0];
if (!schema || schema.tables.length === 0) {
  console.error("✗ The schema parsed, but it has no tables.");
  process.exit(1);
}

console.log(`✓ Parsed ${file}`);
console.log(
  `  ${schema.tables.length} tables · ${schema.enums.length} enums · ${schema.refs.length} refs`,
);
for (const table of schema.tables) {
  console.log(`  • ${table.name} (${table.fields.length} columns)`);
}

// @dbml/core can leave parser handles open; exit explicitly.
process.exit(0);
