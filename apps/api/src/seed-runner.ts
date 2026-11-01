import { openDatabase } from "./db";
import { env } from "./env";
import { seedDatabase } from "./seed";

const force = process.argv.includes("--force");
const db = openDatabase(env.databasePath);
const seeded = seedDatabase(db, { force });
db.close();

if (seeded) {
  console.log(force ? "Database reset and reseeded." : "Database seeded.");
} else {
  console.log("Database already has data. Use `bun run db:reset` to replace it.");
}
