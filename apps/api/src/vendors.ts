import OpenAI from "openai";
import { Resend } from "resend";
import Stripe from "stripe";
import { env } from "./env";

// One client per vendor. Features check `configured()` first, so the API
// runs locally (and in tests) with no keys at all.

export const stripe = new Stripe(env.stripeSecretKey || "sk_test_not_configured", {
  apiVersion: "2023-10-16",
  appInfo: { name: "Taskline", version: "0.1.0" },
});

export const openai = new OpenAI({
  apiKey: env.openaiApiKey || "sk-not-configured",
});

export const resend = new Resend(env.resendApiKey || "re_not_configured");

export function configured() {
  return {
    billing: Boolean(env.stripeSecretKey && env.stripePriceId),
    webhooks: Boolean(env.stripeWebhookSecret),
    assistant: Boolean(env.openaiApiKey),
    email: Boolean(env.resendApiKey),
  };
}
