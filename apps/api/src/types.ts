import { randomUUID } from "node:crypto";
import type { Db } from "./db";

export type Status = "todo" | "in_progress" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";

export type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assignee_id: string | null;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  assignee_name?: string | null;
  assignee_color?: string | null;
  comment_count?: number;
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeColor: string | null;
  dueDate: string | null;
  position: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  created_at: string;
  task_count?: number;
  done_count?: number;
  member_count?: number;
};

export type Project = {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  taskCount: number;
  doneCount: number;
  createdAt: string;
};

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name ?? null,
    assigneeColor: row.assignee_color ?? null,
    dueDate: row.due_date,
    position: row.position,
    commentCount: row.comment_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    color: row.color,
    taskCount: row.task_count ?? 0,
    doneCount: row.done_count ?? 0,
    createdAt: row.created_at,
  };
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "project";
}

export function logActivity(
  db: Db,
  input: {
    projectId: string;
    taskId?: string | null;
    actorId?: string | null;
    action: string;
    detail: string;
  },
): void {
  db.query(
    `INSERT INTO activity (id, project_id, task_id, actor_id, action, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    input.projectId,
    input.taskId ?? null,
    input.actorId ?? null,
    input.action,
    input.detail,
    // ISO like the seed data, so activity sorts correctly by created_at.
    new Date().toISOString(),
  );
}

export function firstMemberId(db: Db): string | null {
  const row = db
    .query("SELECT id FROM members ORDER BY created_at ASC LIMIT 1")
    .get() as { id: string } | null;
  return row?.id ?? null;
}
