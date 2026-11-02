import "./sentry";
import { createApp } from "./app";
import { openDatabase } from "./db";
import { env } from "./env";
import { seedDatabase } from "./seed";

const db = openDatabase(env.databasePath);

const count = db.query("SELECT COUNT(*) AS count FROM projects").get() as {
  count: number;
};
if (count.count === 0) {
  seedDatabase(db);
  console.log("Seeded the empty database with Taskline demo data.");
}

const app = createApp(db);

const server = Bun.serve({
  port: env.port,
  hostname: env.host,
  fetch: app.fetch,
});

console.log("");
console.log("  Taskline API");
console.log(`  → http://${env.host}:${env.port}`);
console.log(`  → http://${env.host}:${env.port}/api/v1/openapi.json`);
console.log(`  → database: ${env.databasePath}`);
console.log("");

function shutdown() {
  console.log("\nStopping Taskline API…");
  server.stop();
  db.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
