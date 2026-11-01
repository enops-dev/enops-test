import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { openDatabase, type Db } from "../src/db";
import { seedDatabase } from "../src/seed";

const MAYA = "22222222-2222-4222-8222-222222222221";
const WEBSITE_PROJECT = "11111111-1111-4111-8111-111111111111";

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  seedDatabase(db);
  app = createApp(db);
});

afterEach(() => {
  db.close();
});

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function post(path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patch(path: string, body: unknown) {
  return app.request(path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("health", () => {
  test("reports the API and database are ready", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);

    const body = await json<{ ok: boolean; service: string; database: string }>(response);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("taskline-api");
    expect(body.database).toBe("sqlite");
  });
});

describe("projects", () => {
  test("lists the seeded projects with task counts", async () => {
    const response = await app.request("/api/v1/projects");
    expect(response.status).toBe(200);

    const body = await json<{ items: Array<{ name: string; taskCount: number }> }>(response);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]?.name).toBe("Website relaunch");
    expect(body.items[0]?.taskCount).toBe(6);
  });

  test("creates a project and rejects an empty name", async () => {
    const created = await post("/api/v1/projects", {
      name: "Billing cleanup",
      description: "Remove the old invoices table.",
    });
    expect(created.status).toBe(201);

    const project = await json<{ id: string; name: string; slug: string }>(created);
    expect(project.name).toBe("Billing cleanup");
    expect(project.slug.startsWith("billing-cleanup-")).toBe(true);

    const invalid = await post("/api/v1/projects", { name: "  " });
    expect(invalid.status).toBe(400);
  });
});

describe("tasks", () => {
  test("creates, updates, comments on, and deletes a task", async () => {
    const created = await post(`/api/v1/projects/${WEBSITE_PROJECT}/tasks`, {
      title: "Add a skip link",
      description: "Keyboard users should reach the main content in one tab.",
      priority: "high",
      assigneeId: MAYA,
      dueDate: "2026-11-01",
    });
    expect(created.status).toBe(201);

    const task = await json<{ id: string; title: string; status: string }>(created);
    expect(task.title).toBe("Add a skip link");
    expect(task.status).toBe("todo");

    const updated = await patch(`/api/v1/tasks/${task.id}`, { status: "in_progress" });
    expect(updated.status).toBe(200);
    const updatedTask = await json<{ status: string }>(updated);
    expect(updatedTask.status).toBe("in_progress");

    const comment = await post(`/api/v1/tasks/${task.id}/comments`, {
      body: "Added this to the accessibility pass.",
      authorId: MAYA,
    });
    expect(comment.status).toBe(201);

    const detail = await app.request(`/api/v1/tasks/${task.id}`);
    const detailBody = await json<{ comments: Array<{ body: string }>; commentCount: number }>(
      detail,
    );
    expect(detailBody.comments).toHaveLength(1);
    expect(detailBody.commentCount).toBe(1);

    const removed = await app.request(`/api/v1/tasks/${task.id}`, { method: "DELETE" });
    expect(removed.status).toBe(204);

    const missing = await app.request(`/api/v1/tasks/${task.id}`);
    expect(missing.status).toBe(404);
  });

  test("rejects a task without a title", async () => {
    const response = await post(`/api/v1/projects/${WEBSITE_PROJECT}/tasks`, { title: "" });
    expect(response.status).toBe(400);
  });

  test("filters tasks by status and returns project statistics", async () => {
    const response = await app.request(
      `/api/v1/projects/${WEBSITE_PROJECT}/tasks?status=done`,
    );
    const body = await json<{ items: Array<{ status: string }> }>(response);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((task) => task.status === "done")).toBe(true);

    const statsResponse = await app.request("/api/v1/stats");
    const stats = await json<{ tasks: number; completionRate: number; overdue: number }>(
      statsResponse,
    );
    expect(stats.tasks).toBe(12);
    expect(stats.completionRate).toBeGreaterThan(0);
    expect(stats.overdue).toBeGreaterThan(0);
  });

  test("records activity when a task moves", async () => {
    const taskId = "33333333-3333-4333-8333-333333333306";
    await patch(`/api/v1/tasks/${taskId}`, { status: "in_progress" });

    const response = await app.request("/api/v1/activity?limit=5");
    const body = await json<{ items: Array<{ action: string; detail: string }> }>(response);
    expect(body.items[0]?.action).toBe("task.moved");
    expect(body.items[0]?.detail).toContain("Fix mobile nav overflow");
  });
});

describe("docs and 404s", () => {
  test("serves an OpenAPI document", async () => {
    const response = await app.request("/api/v1/openapi.json");
    const body = await json<{ openapi: string; paths: Record<string, unknown> }>(response);
    expect(body.openapi).toBe("3.1.0");
    expect(body.paths["/api/v1/tasks/{id}"]).toBeTruthy();
  });

  test("returns JSON for unknown routes", async () => {
    const response = await app.request("/api/v1/nope");
    expect(response.status).toBe(404);
    const body = await json<{ error: string }>(response);
    expect(body.error).toBe("Not Found");
  });
});
