import * as Sentry from "@sentry/bun";
import { env } from "./env";

// Error reporting is optional: without SENTRY_DSN nothing is sent.
if (env.sentryDsn) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: process.env.NODE_ENV ?? "development",
  });
}

export function reportError(error: unknown, context: { method: string; path: string }) {
  if (!env.sentryDsn) return;
  Sentry.withScope((scope) => {
    scope.setTag("route", `${context.method} ${context.path}`);
    Sentry.captureException(error);
  });
}
