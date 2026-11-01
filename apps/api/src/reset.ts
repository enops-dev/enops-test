import { openDatabase } from "./db";
import { env } from "./env";
import { seedDatabase } from "./seed";

const db = openDatabase(env.databasePath);
seedDatabase(db, { force: true });
db.close();

console.log("Reset Taskline data and reseeded the demo projects, tasks, and comments.");
