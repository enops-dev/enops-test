import { resolve } from "node:path";
import * as Sentry from "@sentry/bun";
import { env } from "./env";

// Stack traces use repo-relative paths (apps/api/src/app.ts), not the
// machine's absolute checkout path.
const repoRoot = resolve(import.meta.dir, "../../..");

// Error reporting is optional: without SENTRY_DSN nothing is sent.
if (env.sentryDsn) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: process.env.NODE_ENV ?? "development",
    integrations: [Sentry.rewriteFramesIntegration({ root: repoRoot, prefix: "" })],
  });
}

export function reportError(error: unknown, context: { method: string; path: string }) {
  if (!env.sentryDsn) return;
  Sentry.withScope((scope) => {
    scope.setTag("route", `${context.method} ${context.path}`);
    Sentry.captureException(error);
  });
}
