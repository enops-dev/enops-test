import type Stripe from "stripe";
import type { Db } from "./db";
import { env } from "./env";
import { firstMemberId, logActivity } from "./types";
import { stripe } from "./vendors";

const STATUSES = new Set(["incomplete", "trialing", "active", "past_due", "canceled"]);

/** Throws when the signature does not match the raw body. */
export function verifyStripeEvent(payload: string, signature: string): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, env.stripeWebhookSecret);
}

function syncSubscription(db: Db, subscription: Stripe.Subscription) {
  const projectId = subscription.metadata.projectId;
  if (!projectId) return false;

  const status = STATUSES.has(subscription.status) ? subscription.status : "past_due";
  const plan = status === "active" || status === "trialing" ? "pro" : "free";
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  const customer =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const result = db
    .query(
      `UPDATE subscriptions
         SET stripe_subscription_id = ?, stripe_customer_id = ?, plan = ?, status = ?,
             current_period_end = ?, updated_at = datetime('now')
       WHERE project_id = ?`,
    )
    .run(subscription.id, customer, plan, status, periodEnd, projectId);
  if (result.changes === 0) return false;

  logActivity(db, {
    projectId,
    taskId: null,
    actorId: firstMemberId(db),
    action: "billing.updated",
    detail: plan === "pro" ? "Upgraded to Taskline Pro" : `Subscription is ${status}`,
  });
  return true;
}

export async function applyStripeEvent(db: Db, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (typeof session.subscription !== "string") return { handled: false };
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      return { handled: syncSubscription(db, subscription) };
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return { handled: syncSubscription(db, event.data.object) };
    default:
      return { handled: false };
  }
}
