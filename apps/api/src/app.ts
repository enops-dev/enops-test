import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";
import type { Db } from "./db";
import { env } from "./env";
import { registerIntegrationRoutes } from "./integration-routes";
import { sendAssignmentEmail } from "./mailer";
import {
  firstMemberId,
  logActivity,
  slugify,
  toProject,
  toTask,
  type Priority,
  type ProjectRow,
  type Status,
  type TaskRow,
} from "./types";

const STATUSES = ["todo", "in_progress", "done"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const COLORS = ["violet", "emerald", "amber", "sky", "rose", "stone"] as const;

const projectCreateInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).optional(),
  color: z.enum(COLORS).optional(),
});

const projectUpdateInput = projectCreateInput.partial();

const taskCreateInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullable()
    .optional(),
});

const taskUpdateInput = taskCreateInput.partial().extend({
  position: z.number().int().min(0).optional(),
});

const commentInput = z.object({
  body: z.string().trim().min(1, "Comment is required").max(2000),
  authorId: z.string().uuid().nullable().optional(),
});

const memberInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Use a valid email").max(200),
  role: z.enum(["owner", "admin", "member", "viewer"]).optional(),
  avatarColor: z.enum(COLORS).optional(),
});

type MemberRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_color: string;
  created_at: string;
};

type CommentRow = {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  author_name?: string | null;
  author_color?: string | null;
};

type ActivityRow = {
  id: string;
  project_id: string;
  task_id: string | null;
  action: string;
  detail: string;
  created_at: string;
  project_name?: string | null;
  actor_name?: string | null;
  actor_color?: string | null;
  task_title?: string | null;
};

const TASK_SELECT = `
  SELECT t.*, m.name AS assignee_name, m.avatar_color AS assignee_color,
    (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count
  FROM tasks t
  LEFT JOIN members m ON m.id = t.assignee_id
`;

const PROJECT_SELECT = `
  SELECT p.*,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count
  FROM projects p
`;

function toMember(row: MemberRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatarColor: row.avatar_color,
    createdAt: row.created_at,
  };
}

function toComment(row: CommentRow) {
  return {
    id: row.id,
    taskId: row.task_id,
    authorId: row.author_id,
    authorName: row.author_name ?? null,
    authorColor: row.author_color ?? null,
    body: row.body,
    createdAt: row.created_at,
  };
}

function toActivity(row: ActivityRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name ?? null,
    taskId: row.task_id,
    taskTitle: row.task_title ?? null,
    actorName: row.actor_name ?? null,
    actorColor: row.actor_color ?? null,
    action: row.action,
    detail: row.detail,
    createdAt: row.created_at,
  };
}

function invalid(c: Context, error: z.ZodError) {
  return c.json(
    {
      error: "Invalid request",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
    400,
  );
}

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

function projectStats(db: Db, projectId: string) {
  const row = db
    .query(
      `SELECT
         COUNT(*) AS tasks,
         SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
         SUM(CASE WHEN due_date IS NOT NULL AND due_date < date('now') AND status != 'done' THEN 1 ELSE 0 END) AS overdue
       FROM tasks WHERE project_id = ?`,
    )
    .get(projectId) as { tasks: number | null; done: number | null; overdue: number | null };

  const tasks = Number(row.tasks ?? 0);
  const done = Number(row.done ?? 0);
  return {
    tasks,
    done,
    overdue: Number(row.overdue ?? 0),
    completionRate: tasks === 0 ? 0 : Math.round((done / tasks) * 100),
  };
}

export function createApp(db: Db) {
  const app = new Hono();

  if (process.env.NODE_ENV !== "test") {
    app.use("*", logger());
  }

  app.use(
    "/api/*",
    cors({
      origin: [env.corsOrigin, "http://127.0.0.1:4100"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    }),
  );

  app.get("/", (c) =>
    c.json({
      service: "Taskline API",
      version: "0.1.0",
      health: "/health",
      openapi: "/api/v1/openapi.json",
      web: env.corsOrigin,
    }),
  );

  app.get("/health", (c) => {
    db.query("SELECT 1 AS ok").get();
    return c.json({
      ok: true,
      service: "taskline-api",
      version: "0.1.0",
      database: "sqlite",
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
    });
  });

  app.get("/api/v1/health", (c) => {
    db.query("SELECT 1 AS ok").get();
    return c.json({ ok: true, service: "taskline-api", time: new Date().toISOString() });
  });

  // ── Projects ─────────────────────────────────────────────────────────────

  app.get("/api/v1/projects", (c) => {
    const rows = db
      .query(`${PROJECT_SELECT} ORDER BY p.created_at ASC`)
      .all() as ProjectRow[];
    return c.json({ items: rows.map(toProject) });
  });

  app.post("/api/v1/projects", async (c) => {
    const parsed = projectCreateInput.safeParse(await readJson(c));
    if (!parsed.success) return invalid(c, parsed.error);

    const id = randomUUID();
    const slug = `${slugify(parsed.data.name)}-${id.slice(0, 6)}`;
    db.query(
      `INSERT INTO projects (id, name, slug, description, color)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      id,
      parsed.data.name,
      slug,
      parsed.data.description ?? "",
      parsed.data.color ?? "violet",
    );

    logActivity(db, {
      projectId: id,
      actorId: firstMemberId(db),
      action: "project.created",
      detail: `Created project "${parsed.data.name}"`,
    });

    const row = db.query(`${PROJECT_SELECT} WHERE p.id = ?`).get(id) as ProjectRow;
    return c.json(toProject(row), 201);
  });

  app.get("/api/v1/projects/:id", (c) => {
    const row = db.query(`${PROJECT_SELECT} WHERE p.id = ?`).get(c.req.param("id")) as
      | ProjectRow
      | null;
    if (!row) return c.json({ error: "Project not found" }, 404);

    const members = db
      .query("SELECT * FROM members ORDER BY name ASC")
      .all() as MemberRow[];

    return c.json({
      ...toProject(row),
      stats: projectStats(db, row.id),
      members: members.map(toMember),
    });
  });

  app.patch("/api/v1/projects/:id", async (c) => {
    const id = c.req.param("id");
    const existing = db.query("SELECT * FROM projects WHERE id = ?").get(id) as
      | ProjectRow
      | null;
    if (!existing) return c.json({ error: "Project not found" }, 404);

    const parsed = projectUpdateInput.safeParse(await readJson(c));
    if (!parsed.success) return invalid(c, parsed.error);

    const updates: string[] = [];
    const params: string[] = [];
    if (parsed.data.name !== undefined) {
      updates.push("name = ?");
      params.push(parsed.data.name);
    }
    if (parsed.data.description !== undefined) {
      updates.push("description = ?");
      params.push(parsed.data.description);
    }
    if (parsed.data.color !== undefined) {
      updates.push("color = ?");
      params.push(parsed.data.color);
    }

    if (updates.length === 0) return c.json(toProject(existing));
    db.query(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(...params, id);

    logActivity(db, {
      projectId: id,
      actorId: firstMemberId(db),
      action: "project.updated",
      detail: `Updated project "${parsed.data.name ?? existing.name}"`,
    });

    const row = db.query(`${PROJECT_SELECT} WHERE p.id = ?`).get(id) as ProjectRow;
    return c.json(toProject(row));
  });

  app.delete("/api/v1/projects/:id", (c) => {
    const id = c.req.param("id");
    const existing = db.query("SELECT id FROM projects WHERE id = ?").get(id);
    if (!existing) return c.json({ error: "Project not found" }, 404);
    db.query("DELETE FROM projects WHERE id = ?").run(id);
    return c.body(null, 204);
  });

  // ── Members ──────────────────────────────────────────────────────────────

  app.get("/api/v1/members", (c) => {
    const rows = db.query("SELECT * FROM members ORDER BY name ASC").all() as MemberRow[];
    return c.json({ items: rows.map(toMember) });
  });

  app.post("/api/v1/members", async (c) => {
    const parsed = memberInput.safeParse(await readJson(c));
    if (!parsed.success) return invalid(c, parsed.error);

    const id = randomUUID();
    db.query(
      `INSERT INTO members (id, name, email, role, avatar_color)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      id,
      parsed.data.name,
      parsed.data.email,
      parsed.data.role ?? "member",
      parsed.data.avatarColor ?? "stone",
    );

    const row = db.query("SELECT * FROM members WHERE id = ?").get(id) as MemberRow;
    return c.json(toMember(row), 201);
  });

  // ── Tasks ────────────────────────────────────────────────────────────────

  app.get("/api/v1/projects/:id/tasks", (c) => {
    const projectId = c.req.param("id");
    const project = db.query("SELECT id FROM projects WHERE id = ?").get(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const filters = ["t.project_id = ?"];
    const params: string[] = [projectId];

    const status = c.req.query("status");
    if (status && (STATUSES as readonly string[]).includes(status)) {
      filters.push("t.status = ?");
      params.push(status);
    }

    const assigneeId = c.req.query("assigneeId");
    if (assigneeId) {
      filters.push("t.assignee_id = ?");
      params.push(assigneeId);
    }

    const query = c.req.query("q");
    if (query) {
      filters.push("(t.title LIKE ? OR t.description LIKE ?)");
      params.push(`%${query}%`, `%${query}%`);
    }

    const rows = db
      .query(
        `${TASK_SELECT}
         WHERE ${filters.join(" AND ")}
         ORDER BY CASE t.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
                  t.position ASC, t.created_at ASC`,
      )
      .all(...params) as TaskRow[];

    return c.json({ items: rows.map(toTask) });
  });

  app.post("/api/v1/projects/:id/tasks", async (c) => {
    const projectId = c.req.param("id");
    const project = db.query("SELECT id FROM projects WHERE id = ?").get(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const parsed = taskCreateInput.safeParse(await readJson(c));
    if (!parsed.success) return invalid(c, parsed.error);

    if (parsed.data.assigneeId) {
      const member = db
        .query("SELECT id FROM members WHERE id = ?")
        .get(parsed.data.assigneeId);
      if (!member) return c.json({ error: "Assignee not found" }, 400);
    }

    const status: Status = parsed.data.status ?? "todo";
    const next = db
      .query(
        "SELECT COALESCE(MAX(position), 0) + 1 AS next FROM tasks WHERE project_id = ? AND status = ?",
      )
      .get(projectId, status) as { next: number };

    const id = randomUUID();
    db.query(
      `INSERT INTO tasks
         (id, project_id, title, description, status, priority, assignee_id, due_date, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      projectId,
      parsed.data.title,
      parsed.data.description ?? "",
      status,
      parsed.data.priority ?? "medium",
      parsed.data.assigneeId ?? null,
      parsed.data.dueDate ?? null,
      next.next,
    );

    logActivity(db, {
      projectId,
      taskId: id,
      actorId: firstMemberId(db),
      action: "task.created",
      detail: `Created "${parsed.data.title}"`,
    });

    const row = db.query(`${TASK_SELECT} WHERE t.id = ?`).get(id) as TaskRow;
    return c.json(toTask(row), 201);
  });

  app.get("/api/v1/tasks/:id", (c) => {
    const id = c.req.param("id");
    const row = db.query(`${TASK_SELECT} WHERE t.id = ?`).get(id) as TaskRow | null;
    if (!row) return c.json({ error: "Task not found" }, 404);

    const comments = db
      .query(
        `SELECT c.*, m.name AS author_name, m.avatar_color AS author_color
         FROM comments c
         LEFT JOIN members m ON m.id = c.author_id
         WHERE c.task_id = ?
         ORDER BY c.created_at ASC`,
      )
      .all(id) as CommentRow[];

    return c.json({ ...toTask(row), comments: comments.map(toComment) });
  });

  app.patch("/api/v1/tasks/:id", async (c) => {
    const id = c.req.param("id");
    const existing = db.query(`${TASK_SELECT} WHERE t.id = ?`).get(id) as TaskRow | null;
    if (!existing) return c.json({ error: "Task not found" }, 404);

    const parsed = taskUpdateInput.safeParse(await readJson(c));
    if (!parsed.success) return invalid(c, parsed.error);

    if (parsed.data.assigneeId) {
      const member = db
        .query("SELECT id FROM members WHERE id = ?")
        .get(parsed.data.assigneeId);
      if (!member) return c.json({ error: "Assignee not found" }, 400);
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (parsed.data.title !== undefined) {
      updates.push("title = ?");
      params.push(parsed.data.title);
    }
    if (parsed.data.description !== undefined) {
      updates.push("description = ?");
      params.push(parsed.data.description);
    }
    if (parsed.data.status !== undefined) {
      updates.push("status = ?");
      params.push(parsed.data.status);
    }
    if (parsed.data.priority !== undefined) {
      updates.push("priority = ?");
      params.push(parsed.data.priority);
    }
    if (parsed.data.assigneeId !== undefined) {
      updates.push("assignee_id = ?");
      params.push(parsed.data.assigneeId);
    }
    if (parsed.data.dueDate !== undefined) {
      updates.push("due_date = ?");
      params.push(parsed.data.dueDate);
    }
    if (parsed.data.position !== undefined) {
      updates.push("position = ?");
      params.push(parsed.data.position);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      db.query(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`).run(...params, id);

      const statusChanged =
        parsed.data.status !== undefined && parsed.data.status !== existing.status;
      const title = parsed.data.title ?? existing.title;
      logActivity(db, {
        projectId: existing.project_id,
        taskId: id,
        actorId: firstMemberId(db),
        action: statusChanged ? "task.moved" : "task.updated",
        detail: statusChanged
          ? `Moved "${title}" to ${labelForStatus(parsed.data.status as Status)}`
          : `Updated "${title}"`,
      });
    }

    const row = db.query(`${TASK_SELECT} WHERE t.id = ?`).get(id) as TaskRow;
    if (parsed.data.assigneeId && parsed.data.assigneeId !== existing.assignee_id) {
      const assignee = db
        .query("SELECT name, email FROM members WHERE id = ?")
        .get(parsed.data.assigneeId) as { name: string; email: string };
      await sendAssignmentEmail(assignee, toTask(row)).catch((error: unknown) =>
        console.error("Assignment email failed", error),
      );
    }
    return c.json(toTask(row));
  });

  app.delete("/api/v1/tasks/:id", (c) => {
    const id = c.req.param("id");
    const row = db.query(`${TASK_SELECT} WHERE t.id = ?`).get(id) as TaskRow | null;
    if (!row) return c.json({ error: "Task not found" }, 404);

    logActivity(db, {
      projectId: row.project_id,
      taskId: id,
      actorId: firstMemberId(db),
      action: "task.deleted",
      detail: `Deleted "${row.title}"`,
    });
    db.query("DELETE FROM tasks WHERE id = ?").run(id);
    return c.body(null, 204);
  });

  // ── Comments ─────────────────────────────────────────────────────────────

  app.get("/api/v1/tasks/:id/comments", (c) => {
    const id = c.req.param("id");
    const task = db.query("SELECT id FROM tasks WHERE id = ?").get(id);
    if (!task) return c.json({ error: "Task not found" }, 404);

    const rows = db
      .query(
        `SELECT c.*, m.name AS author_name, m.avatar_color AS author_color
         FROM comments c
         LEFT JOIN members m ON m.id = c.author_id
         WHERE c.task_id = ?
         ORDER BY c.created_at ASC`,
      )
      .all(id) as CommentRow[];

    return c.json({ items: rows.map(toComment) });
  });

  app.post("/api/v1/tasks/:id/comments", async (c) => {
    const taskId = c.req.param("id");
    const task = db
      .query("SELECT id, project_id, title FROM tasks WHERE id = ?")
      .get(taskId) as { id: string; project_id: string; title: string } | null;
    if (!task) return c.json({ error: "Task not found" }, 404);

    const parsed = commentInput.safeParse(await readJson(c));
    if (!parsed.success) return invalid(c, parsed.error);

    const authorId = parsed.data.authorId ?? firstMemberId(db);
    if (authorId) {
      const member = db.query("SELECT id FROM members WHERE id = ?").get(authorId);
      if (!member) return c.json({ error: "Author not found" }, 400);
    }

    const id = randomUUID();
    db.query(
      `INSERT INTO comments (id, task_id, author_id, body) VALUES (?, ?, ?, ?)`,
    ).run(id, taskId, authorId ?? null, parsed.data.body);

    logActivity(db, {
      projectId: task.project_id,
      taskId,
      actorId: authorId,
      action: "comment.added",
      detail: `Commented on "${task.title}"`,
    });

    const row = db
      .query(
        `SELECT c.*, m.name AS author_name, m.avatar_color AS author_color
         FROM comments c
         LEFT JOIN members m ON m.id = c.author_id
         WHERE c.id = ?`,
      )
      .get(id) as CommentRow;

    return c.json(toComment(row), 201);
  });

  // ── Stats & activity ─────────────────────────────────────────────────────

  app.get("/api/v1/stats", (c) => {
    const totals = db
      .query(
        `SELECT
           COUNT(*) AS tasks,
           SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
           SUM(CASE WHEN due_date IS NOT NULL AND due_date < date('now') AND status != 'done' THEN 1 ELSE 0 END) AS overdue
         FROM tasks`,
      )
      .get() as { tasks: number; done: number | null; overdue: number | null };

    const byStatus: Record<Status, number> = { todo: 0, in_progress: 0, done: 0 };
    for (const row of db
      .query("SELECT status, COUNT(*) AS count FROM tasks GROUP BY status")
      .all() as { status: Status; count: number }[]) {
      byStatus[row.status] = row.count;
    }

    const byPriority: Record<Priority, number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };
    for (const row of db
      .query("SELECT priority, COUNT(*) AS count FROM tasks GROUP BY priority")
      .all() as { priority: Priority; count: number }[]) {
      byPriority[row.priority] = row.count;
    }

    const commentCount = db.query("SELECT COUNT(*) AS count FROM comments").get() as {
      count: number;
    };
    const memberCount = db.query("SELECT COUNT(*) AS count FROM members").get() as {
      count: number;
    };

    const tasks = Number(totals.tasks ?? 0);
    const done = Number(totals.done ?? 0);

    return c.json({
      tasks,
      done,
      completionRate: tasks === 0 ? 0 : Math.round((done / tasks) * 100),
      overdue: Number(totals.overdue ?? 0),
      byStatus,
      byPriority,
      comments: commentCount.count,
      members: memberCount.count,
    });
  });

  app.get("/api/v1/activity", (c) => {
    const requested = Number(c.req.query("limit") ?? 40);
    const limit = Number.isFinite(requested)
      ? Math.min(Math.max(Math.trunc(requested), 1), 200)
      : 40;

    const rows = db
      .query(
        `SELECT a.*, p.name AS project_name, m.name AS actor_name,
                m.avatar_color AS actor_color, t.title AS task_title
         FROM activity a
         LEFT JOIN projects p ON p.id = a.project_id
         LEFT JOIN members m ON m.id = a.actor_id
         LEFT JOIN tasks t ON t.id = a.task_id
         ORDER BY a.created_at DESC
         LIMIT ?`,
      )
      .all(limit) as ActivityRow[];

    return c.json({ items: rows.map(toActivity) });
  });

  // ── OpenAPI ──────────────────────────────────────────────────────────────

  app.get("/api/v1/openapi.json", (c) => c.json(openApiDocument));

  registerIntegrationRoutes(app, db);

  // ── Errors ───────────────────────────────────────────────────────────────

  app.notFound((c) => c.json({ error: "Not Found", path: c.req.path }, 404));

  app.onError((error, c) => {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${c.req.method}] ${c.req.path}`, error);
    }
    return c.json(
      {
        error: "Internal Server Error",
        message: error.message,
        requestId: randomUUID(),
      },
      500,
    );
  });

  return app;
}

function labelForStatus(status: Status): string {
  if (status === "todo") return "To do";
  if (status === "in_progress") return "In progress";
  return "Done";
}

const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Taskline API",
    version: "0.1.0",
    description:
      "Projects, tasks, comments, billing, and team invites for Taskline.",
  },
  servers: [{ url: "http://localhost:4101", description: "Local Taskline API" }],
  tags: [
    { name: "Health" },
    { name: "Projects" },
    { name: "Members" },
    { name: "Tasks" },
    { name: "Comments" },
    { name: "Insights" },
    { name: "Testing" },
  ],
  paths: {
    "/health": {
      get: { tags: ["Health"], summary: "Service health", responses: { "200": { description: "OK" } } },
    },
    "/api/v1/projects": {
      get: { tags: ["Projects"], summary: "List projects", responses: { "200": { description: "OK" } } },
      post: {
        tags: ["Projects"],
        summary: "Create a project",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ProjectInput" } } } },
        responses: { "201": { description: "Created" }, "400": { description: "Invalid request" } },
      },
    },
    "/api/v1/projects/{id}/tasks": {
      get: {
        tags: ["Tasks"],
        summary: "List tasks in a project",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["todo", "in_progress", "done"] } },
        ],
        responses: { "200": { description: "OK" } },
      },
      post: {
        tags: ["Tasks"],
        summary: "Create a task",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/TaskInput" } } } },
        responses: { "201": { description: "Created" }, "400": { description: "Invalid request" } },
      },
    },
    "/api/v1/tasks/{id}": {
      get: {
        tags: ["Tasks"],
        summary: "Get a task with comments",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
      },
      patch: {
        tags: ["Tasks"],
        summary: "Update a task",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" }, "400": { description: "Invalid request" } },
      },
      delete: {
        tags: ["Tasks"],
        summary: "Delete a task",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "204": { description: "Deleted" }, "404": { description: "Not found" } },
      },
    },
    "/api/v1/stats": {
      get: { tags: ["Insights"], summary: "Task counts and completion rate", responses: { "200": { description: "OK" } } },
    },
    "/api/v1/activity": {
      get: { tags: ["Insights"], summary: "Recent activity", responses: { "200": { description: "OK" } } },
    },
    "/api/v1/projects/{id}/billing/checkout": {
      post: {
        tags: ["Billing"],
        summary: "Start a Stripe Checkout for Taskline Pro",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Checkout URL" }, "503": { description: "Billing not configured" } },
      },
    },
    "/api/v1/projects/{id}/billing/portal": {
      post: {
        tags: ["Billing"],
        summary: "Open the Stripe customer portal",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Portal URL" }, "409": { description: "No subscription" } },
      },
    },
    "/api/v1/webhooks/stripe": {
      post: { tags: ["Billing"], summary: "Stripe webhook (signed)", responses: { "200": { description: "Received" }, "400": { description: "Bad signature" } } },
    },
    "/api/v1/tasks/{id}/summary": {
      post: {
        tags: ["Assistant"],
        summary: "Summarize a task and its comments",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
      },
    },
    "/api/v1/tasks/suggest": {
      post: { tags: ["Assistant"], summary: "Suggest subtasks for a title", responses: { "200": { description: "OK" } } },
    },
    "/api/v1/projects/{id}/invites": {
      post: {
        tags: ["Members"],
        summary: "Invite someone by email",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "201": { description: "Invite created" } },
      },
    },
    "/api/v1/invites/accept": {
      post: { tags: ["Members"], summary: "Accept an invite link", responses: { "200": { description: "OK" }, "410": { description: "Invalid or used" } } },
    },
    "/api/v1/digest/weekly": {
      post: { tags: ["Insights"], summary: "Send the weekly digest email", responses: { "200": { description: "OK" } } },
    },
  },
  components: {
    schemas: {
      ProjectInput: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", maxLength: 120 },
          description: { type: "string", maxLength: 500 },
          color: { type: "string", enum: ["violet", "emerald", "amber", "sky", "rose", "stone"] },
        },
      },
      TaskInput: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", maxLength: 200 },
          description: { type: "string", maxLength: 5000 },
          status: { type: "string", enum: ["todo", "in_progress", "done"] },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
          assigneeId: { type: ["string", "null"], format: "uuid" },
          dueDate: { type: ["string", "null"], format: "date" },
        },
      },
    },
  },
} as const;
