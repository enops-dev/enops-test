import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app";
import { openDatabase, type Db } from "../src/db";
import { env } from "../src/env";
import { seedDatabase } from "../src/seed";
import { openai, resend, stripe } from "../src/vendors";

const WEBSITE_PROJECT = "11111111-1111-4111-8111-111111111111";
const MAYA = "22222222-2222-4222-8222-222222222221";
const saved = { ...env };

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  Object.assign(env, {
    stripeSecretKey: "sk_test_123",
    stripePriceId: "price_pro_monthly",
    stripeWebhookSecret: "whsec_test_secret",
    openaiApiKey: "sk-test",
    resendApiKey: "re_test",
  });
  db = openDatabase(":memory:");
  seedDatabase(db);
  app = createApp(db);
});

afterEach(() => {
  Object.assign(env, saved);
  mock.restore();
  db.close();
});

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function json(response: Response): Promise<any> {
  return response.json();
}

function firstTaskId() {
  return (db.query("SELECT id FROM tasks ORDER BY position LIMIT 1").get() as { id: string }).id;
}

describe("integrations", () => {
  test("report which vendors are configured", async () => {
    env.openaiApiKey = "";
    const body = await json(await app.request("/api/v1/integrations"));
    expect(body).toEqual({ billing: true, webhooks: true, assistant: false, email: true });
  });

  test("return 503 instead of calling a vendor without keys", async () => {
    env.stripeSecretKey = "";
    const create = spyOn(stripe.checkout.sessions, "create");
    const response = await post(`/api/v1/projects/${WEBSITE_PROJECT}/billing/checkout`, {
      email: "maya@taskline.dev",
    });
    expect(response.status).toBe(503);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("billing", () => {
  test("creates a customer once and opens a subscription checkout", async () => {
    const customers = spyOn(stripe.customers, "create").mockResolvedValue({ id: "cus_1" } as never);
    const sessions = spyOn(stripe.checkout.sessions, "create").mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
    } as never);

    for (let i = 0; i < 2; i += 1) {
      const response = await post(`/api/v1/projects/${WEBSITE_PROJECT}/billing/checkout`, {
        email: "maya@taskline.dev",
      });
      expect(response.status).toBe(200);
      expect((await json(response)).url).toContain("checkout.stripe.com");
    }

    expect(customers).toHaveBeenCalledTimes(1);
    expect(sessions.mock.calls[0]?.[0]).toMatchObject({
      mode: "subscription",
      customer: "cus_1",
      client_reference_id: WEBSITE_PROJECT,
      line_items: [{ price: "price_pro_monthly", quantity: 1 }],
    });
  });

  test("a signed checkout.session.completed webhook upgrades the project", async () => {
    db.query(
      "INSERT INTO subscriptions (id, project_id, stripe_customer_id) VALUES ('s1', ?, 'cus_1')",
    ).run(WEBSITE_PROJECT);
    spyOn(stripe.subscriptions, "retrieve").mockResolvedValue({
      id: "sub_1",
      status: "active",
      customer: "cus_1",
      current_period_end: 1_798_761_600,
      metadata: { projectId: WEBSITE_PROJECT },
    } as never);

    const payload = JSON.stringify({
      id: "evt_1",
      object: "event",
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", object: "checkout.session", subscription: "sub_1" } },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_test_secret",
    });

    const response = await post("/api/v1/webhooks/stripe", payload, { "stripe-signature": signature });
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ received: true, handled: true });

    const billing = await json(await app.request(`/api/v1/projects/${WEBSITE_PROJECT}/billing`));
    expect(billing).toMatchObject({ plan: "pro", status: "active" });
  });

  test("rejects a webhook with a bad signature", async () => {
    const response = await post("/api/v1/webhooks/stripe", "{}", { "stripe-signature": "t=1,v1=bad" });
    expect(response.status).toBe(400);
  });
});

describe("assistant", () => {
  test("summarizes a task from its description and comments", async () => {
    const create = spyOn(openai.chat.completions, "create").mockResolvedValue({
      model: "gpt-4o-mini",
      choices: [{ message: { content: "  Waiting on design review.  " } }],
    } as never);

    const response = await post(`/api/v1/tasks/${firstTaskId()}/summary`, {});
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ summary: "Waiting on design review.", model: "gpt-4o-mini" });
    expect(create.mock.calls[0]?.[0]).toMatchObject({ model: env.openaiModel });
  });

  test("suggests subtasks and drops malformed model output", async () => {
    const create = spyOn(openai.chat.completions, "create");
    create.mockResolvedValueOnce({
      choices: [{ message: { content: '{"subtasks":["Draft copy","Review"]}' } }],
    } as never);
    const ok = await post("/api/v1/tasks/suggest", { title: "Launch pricing page" });
    expect((await json(ok)).subtasks).toEqual(["Draft copy", "Review"]);

    create.mockResolvedValueOnce({ choices: [{ message: { content: '{"items":1}' } }] } as never);
    const bad = await post("/api/v1/tasks/suggest", { title: "Launch pricing page" });
    expect((await json(bad)).subtasks).toEqual([]);
  });
});

describe("email and invites", () => {
  test("emails the new assignee when a task is reassigned", async () => {
    const send = spyOn(resend.emails, "send").mockResolvedValue({ data: { id: "em_1" }, error: null } as never);
    db.query("UPDATE tasks SET assignee_id = NULL WHERE id = ?").run(firstTaskId());

    const response = await app.request(`/api/v1/tasks/${firstTaskId()}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assigneeId: MAYA }),
    });
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({ subject: expect.stringContaining("You were assigned") });
  });

  test("invites someone with a signed link they can accept once", async () => {
    spyOn(resend.emails, "send").mockResolvedValue({ data: { id: "em_2" }, error: null } as never);
    const created = await post(`/api/v1/projects/${WEBSITE_PROJECT}/invites`, { email: "sam@example.com" });
    expect(created.status).toBe(201);
    const { link, email } = await json(created);
    expect(email).toEqual({ sent: true, id: "em_2" });

    const token = new URL(link).searchParams.get("token") ?? "";
    const accepted = await post("/api/v1/invites/accept", { token, name: "Sam" });
    expect(accepted.status).toBe(200);
    expect(db.query("SELECT name FROM members WHERE email = 'sam@example.com'").get()).toEqual({ name: "Sam" });

    const again = await post("/api/v1/invites/accept", { token, name: "Sam" });
    expect(again.status).toBe(410);
    const forged = await post("/api/v1/invites/accept", { token: `${token}x`, name: "Sam" });
    expect(forged.status).toBe(410);
  });

  test("rejects an unsigned (alg none) invite token", async () => {
    spyOn(resend.emails, "send").mockResolvedValue({ data: { id: "em_3" }, error: null } as never);
    const created = await post(`/api/v1/projects/${WEBSITE_PROJECT}/invites`, { email: "alex@example.com" });
    const { link } = await json(created);
    const token = new URL(link).searchParams.get("token") ?? "";
    const claims = jwt.decode(token) as Record<string, unknown>;

    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({ alg: "none", typ: "JWT" })}.${encode(claims)}.`;

    const response = await post("/api/v1/invites/accept", { token: unsigned, name: "Alex" });
    expect(response.status).toBe(410);
    expect(db.query("SELECT id FROM members WHERE email = 'alex@example.com'").get()).toBeNull();
  });

  test("sends one weekly digest per member with open work", async () => {
    const batch = spyOn(resend.batch, "send").mockImplementation(
      async (emails) => ({ data: { data: emails.map((_, i) => ({ id: `em_${i}` })) }, error: null }) as never,
    );
    const response = await post("/api/v1/digest/weekly", {});
    const body = await json(response);
    expect(body.recipients).toBeGreaterThan(0);
    expect(body.sent).toBe(body.recipients);
    expect(batch).toHaveBeenCalledTimes(1);
  });
});
