import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// The project keeps one .env at the repo root. Load it before reading
// process.env so `bun run dev:api` behaves the same from any workspace.
const root = resolve(import.meta.dir, "../../..");
const envFile = resolve(root, ".env");

if (existsSync(envFile)) {
  for (const rawLine of readFileSync(envFile, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals === -1) continue;

    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export const env = {
  port: Number(process.env.PORT ?? 4101),
  host: process.env.HOST ?? "127.0.0.1",
  databasePath: resolve(root, process.env.DATABASE_PATH ?? "data/taskline.db"),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:4100",
  appUrl: process.env.APP_URL ?? "http://localhost:4100",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePriceId: process.env.STRIPE_PRICE_ID ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Taskline <hello@taskline.dev>",
  inviteSecret: process.env.INVITE_SECRET ?? "dev-only-invite-secret",
};

export const projectRoot = root;
