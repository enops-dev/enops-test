import { randomUUID } from "node:crypto";
import type { Db } from "./db";
import { env } from "./env";
import { stripe } from "./vendors";

export type SubscriptionRow = {
  id: string;
  project_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  plan: "free" | "pro";
  status: "incomplete" | "trialing" | "active" | "past_due" | "canceled";
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export function subscriptionFor(db: Db, projectId: string) {
  return db
    .query("SELECT * FROM subscriptions WHERE project_id = ?")
    .get(projectId) as SubscriptionRow | null;
}

export function toBilling(row: SubscriptionRow | null) {
  return {
    plan: row?.plan ?? "free",
    status: row?.status ?? "none",
    currentPeriodEnd: row?.current_period_end ?? null,
  };
}

/** Reuses the project's Stripe customer, or creates one on first upgrade. */
async function customerFor(db: Db, projectId: string, email: string, name: string) {
  const existing = subscriptionFor(db, projectId);
  if (existing) return existing.stripe_customer_id;

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { projectId },
  });
  db.query(
    `INSERT INTO subscriptions (id, project_id, stripe_customer_id) VALUES (?, ?, ?)`,
  ).run(randomUUID(), projectId, customer.id);
  return customer.id;
}

export async function startCheckout(
  db: Db,
  project: { id: string; name: string; slug: string },
  email: string,
) {
  const customer = await customerFor(db, project.id, email, project.name);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: env.stripePriceId, quantity: 1 }],
    client_reference_id: project.id,
    subscription_data: { metadata: { projectId: project.id } },
    success_url: `${env.appUrl}/projects/${project.slug}?billing=success`,
    cancel_url: `${env.appUrl}/projects/${project.slug}?billing=canceled`,
    allow_promotion_codes: true,
  });
  return { url: session.url };
}

export async function openBillingPortal(db: Db, project: { id: string; slug: string }) {
  const subscription = subscriptionFor(db, project.id);
  if (!subscription) return null;

  const portal = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${env.appUrl}/projects/${project.slug}`,
  });
  return { url: portal.url };
}
