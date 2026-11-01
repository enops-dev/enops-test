import type { Hono } from "hono";
import { z } from "zod";
import { suggestSubtasks, summarizeTask } from "./assistant";
import { openBillingPortal, startCheckout, subscriptionFor, toBilling } from "./billing";
import type { Db } from "./db";
import { acceptInvite, createInvite, readInvite } from "./invites";
import { sendInviteEmail, sendWeeklyDigest } from "./mailer";
import { firstMemberId, logActivity } from "./types";
import { configured } from "./vendors";
import { applyStripeEvent, verifyStripeEvent } from "./webhooks";

const checkoutInput = z.object({ email: z.string().trim().email("Use a valid email") });
const suggestInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(5000).optional(),
});
const inviteInput = z.object({
  email: z.string().trim().email("Use a valid email").max(200),
  role: z.enum(["admin", "member", "viewer"]).optional(),
});
const acceptInput = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(120),
});

type ProjectLookup = { id: string; name: string; slug: string };

async function body(c: { req: { json(): Promise<unknown> } }) {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

export function registerIntegrationRoutes(app: Hono, db: Db) {
  const project = (id: string) =>
    db.query("SELECT id, name, slug FROM projects WHERE id = ?").get(id) as ProjectLookup | null;
  const notConfigured = (feature: string) => ({ error: `${feature} is not configured on this server` });

  app.get("/api/v1/integrations", (c) => c.json(configured()));

  // ── Billing (Stripe) ────────────────────────────────────────────────────

  app.get("/api/v1/projects/:id/billing", (c) => {
    const found = project(c.req.param("id"));
    if (!found) return c.json({ error: "Project not found" }, 404);
    return c.json(toBilling(subscriptionFor(db, found.id)));
  });

  app.post("/api/v1/projects/:id/billing/checkout", async (c) => {
    if (!configured().billing) return c.json(notConfigured("Billing"), 503);
    const found = project(c.req.param("id"));
    if (!found) return c.json({ error: "Project not found" }, 404);
    const parsed = checkoutInput.safeParse(await body(c));
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message }, 400);
    return c.json(await startCheckout(db, found, parsed.data.email));
  });

  app.post("/api/v1/projects/:id/billing/portal", async (c) => {
    if (!configured().billing) return c.json(notConfigured("Billing"), 503);
    const found = project(c.req.param("id"));
    if (!found) return c.json({ error: "Project not found" }, 404);
    const portal = await openBillingPortal(db, found);
    if (!portal) return c.json({ error: "This project has no subscription yet" }, 409);
    return c.json(portal);
  });

  app.post("/api/v1/webhooks/stripe", async (c) => {
    if (!configured().webhooks) return c.json(notConfigured("Stripe webhooks"), 503);
    const signature = c.req.header("stripe-signature");
    if (!signature) return c.json({ error: "Missing Stripe-Signature header" }, 400);

    let event;
    try {
      event = verifyStripeEvent(await c.req.text(), signature);
    } catch {
      return c.json({ error: "Invalid signature" }, 400);
    }
    return c.json({ received: true, ...(await applyStripeEvent(db, event)) });
  });

  // ── Assistant (OpenAI) ──────────────────────────────────────────────────

  app.post("/api/v1/tasks/:id/summary", async (c) => {
    if (!configured().assistant) return c.json(notConfigured("The assistant"), 503);
    const result = await summarizeTask(db, c.req.param("id"));
    if (!result) return c.json({ error: "Task not found" }, 404);
    return c.json(result);
  });

  app.post("/api/v1/tasks/suggest", async (c) => {
    if (!configured().assistant) return c.json(notConfigured("The assistant"), 503);
    const parsed = suggestInput.safeParse(await body(c));
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message }, 400);
    return c.json({ subtasks: await suggestSubtasks(parsed.data.title, parsed.data.description) });
  });

  // ── Invites (signed links + Resend) ─────────────────────────────────────

  app.post("/api/v1/projects/:id/invites", async (c) => {
    const found = project(c.req.param("id"));
    if (!found) return c.json({ error: "Project not found" }, 404);
    const parsed = inviteInput.safeParse(await body(c));
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message }, 400);

    const invite = createInvite(db, {
      projectId: found.id,
      email: parsed.data.email,
      role: parsed.data.role ?? "member",
      invitedBy: firstMemberId(db),
    });
    const email = await sendInviteEmail(parsed.data.email, found.name, invite.link);
    logActivity(db, {
      projectId: found.id,
      actorId: firstMemberId(db),
      action: "member.invited",
      detail: `Invited ${parsed.data.email}`,
    });
    return c.json({ id: invite.id, link: invite.link, expiresAt: invite.expiresAt, email }, 201);
  });

  app.post("/api/v1/invites/accept", async (c) => {
    const parsed = acceptInput.safeParse(await body(c));
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message }, 400);
    const invite = readInvite(db, parsed.data.token);
    if (!invite) return c.json({ error: "This invite is invalid or was already used" }, 410);
    const memberId = acceptInvite(db, invite, parsed.data.name);
    return c.json({ memberId, projectId: invite.project_id });
  });

  // ── Weekly digest ───────────────────────────────────────────────────────

  app.post("/api/v1/digest/weekly", async (c) => c.json(await sendWeeklyDigest(db)));
}
