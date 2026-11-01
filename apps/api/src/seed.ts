import type { Db } from "./db";

type SeedMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor: string;
};

type SeedTask = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assigneeId: string | null;
  dueOffset: number | null;
  position: number;
};

const MEMBERS: SeedMember[] = [
  { id: "22222222-2222-4222-8222-222222222221", name: "Maya Chen", email: "maya@taskline.dev", role: "owner", avatarColor: "violet" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Dev Patel", email: "dev@taskline.dev", role: "admin", avatarColor: "emerald" },
  { id: "22222222-2222-4222-8222-222222222223", name: "Lina Ortiz", email: "lina@taskline.dev", role: "member", avatarColor: "amber" },
  { id: "22222222-2222-4222-8222-222222222224", name: "Noah Kim", email: "noah@taskline.dev", role: "member", avatarColor: "sky" },
];

const PROJECTS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Website relaunch",
    slug: "website-relaunch-a1b2c3",
    description: "Ship the new marketing site and a shorter onboarding flow.",
    color: "violet",
  },
  {
    id: "11111111-1111-4111-8111-111111111112",
    name: "Mobile API v2",
    slug: "mobile-api-v2-d4e5f6",
    description: "Version the public API, add device sessions, and keep v1 alive.",
    color: "emerald",
  },
];

const TASKS: SeedTask[] = [
  {
    id: "33333333-3333-4333-8333-333333333301",
    projectId: PROJECTS[0]!.id,
    title: "Audit the current onboarding flow",
    description: "Watch five new signups, note every place they hesitate, and write down the three biggest drop-off points.",
    status: "done",
    priority: "high",
    assigneeId: MEMBERS[0]!.id,
    dueOffset: -5,
    position: 1,
  },
  {
    id: "33333333-3333-4333-8333-333333333302",
    projectId: PROJECTS[0]!.id,
    title: "Design new signup screens",
    description: "Three screens: account, workspace, and first project. Keep the copy under 40 words per screen.",
    status: "in_progress",
    priority: "high",
    assigneeId: MEMBERS[2]!.id,
    dueOffset: 2,
    position: 1,
  },
  {
    id: "33333333-3333-4333-8333-333333333303",
    projectId: PROJECTS[0]!.id,
    title: "Write landing page copy",
    description: "Lead with the outcome, not the architecture. One primary call to action per section.",
    status: "in_progress",
    priority: "medium",
    assigneeId: MEMBERS[1]!.id,
    dueOffset: 4,
    position: 2,
  },
  {
    id: "33333333-3333-4333-8333-333333333304",
    projectId: PROJECTS[0]!.id,
    title: "Build responsive pricing table",
    description: "Three plans, monthly and yearly toggle. Must work at 375px without horizontal scrolling.",
    status: "todo",
    priority: "medium",
    assigneeId: MEMBERS[3]!.id,
    dueOffset: 6,
    position: 1,
  },
  {
    id: "33333333-3333-4333-8333-333333333305",
    projectId: PROJECTS[0]!.id,
    title: "Set up analytics events",
    description: "Track signup started, signup completed, project created, and first task created.",
    status: "todo",
    priority: "low",
    assigneeId: null,
    dueOffset: 8,
    position: 2,
  },
  {
    id: "33333333-3333-4333-8333-333333333306",
    projectId: PROJECTS[0]!.id,
    title: "Fix mobile nav overflow",
    description: "The project menu pushes the page sideways on small screens. Reproduce at 375px first.",
    status: "todo",
    priority: "urgent",
    assigneeId: MEMBERS[2]!.id,
    dueOffset: -1,
    position: 3,
  },
  {
    id: "33333333-3333-4333-8333-333333333307",
    projectId: PROJECTS[1]!.id,
    title: "Define v2 resource shapes",
    description: "Write the request and response examples for projects, tasks, and comments. Keep names stable.",
    status: "done",
    priority: "high",
    assigneeId: MEMBERS[1]!.id,
    dueOffset: -4,
    position: 1,
  },
  {
    id: "33333333-3333-4333-8333-333333333308",
    projectId: PROJECTS[1]!.id,
    title: "Add device session table",
    description: "Store device name, last seen, and revoked-at. Add an index on member and last seen.",
    status: "in_progress",
    priority: "urgent",
    assigneeId: MEMBERS[0]!.id,
    dueOffset: 1,
    position: 1,
  },
  {
    id: "33333333-3333-4333-8333-333333333309",
    projectId: PROJECTS[1]!.id,
    title: "Write migration guide",
    description: "Show v1 and v2 calls side by side. Include one example for pagination and one for errors.",
    status: "todo",
    priority: "medium",
    assigneeId: MEMBERS[3]!.id,
    dueOffset: 9,
    position: 1,
  },
  {
    id: "33333333-3333-4333-8333-333333333310",
    projectId: PROJECTS[1]!.id,
    title: "Add rate limit headers",
    description: "Return limit, remaining, and reset on every response. Document the 429 body.",
    status: "todo",
    priority: "high",
    assigneeId: MEMBERS[1]!.id,
    dueOffset: 5,
    position: 2,
  },
  {
    id: "33333333-3333-4333-8333-333333333311",
    projectId: PROJECTS[1]!.id,
    title: "Record API walkthrough",
    description: "A five minute video for the support team: create a project, add a task, comment, and close it.",
    status: "done",
    priority: "low",
    assigneeId: MEMBERS[3]!.id,
    dueOffset: -2,
    position: 2,
  },
  {
    id: "33333333-3333-4333-8333-333333333312",
    projectId: PROJECTS[1]!.id,
    title: "Deprecate legacy endpoint",
    description: "Keep /v1/tasks working until the mobile release is live, then return a migration link.",
    status: "todo",
    priority: "medium",
    assigneeId: null,
    dueOffset: 12,
    position: 3,
  },
];

const COMMENTS = [
  {
    id: "44444444-4444-4444-8444-444444444401",
    taskId: TASKS[1]!.id,
    authorId: MEMBERS[0]!.id,
    body: "The second screen feels long. Can we move workspace naming after the first project?",
    offset: -1,
  },
  {
    id: "44444444-4444-4444-8444-444444444402",
    taskId: TASKS[1]!.id,
    authorId: MEMBERS[2]!.id,
    body: "Yes — I'll post a revised flow this afternoon and keep the primary button in the same place.",
    offset: -0.5,
  },
  {
    id: "44444444-4444-4444-8444-444444444403",
    taskId: TASKS[7]!.id,
    authorId: MEMBERS[1]!.id,
    body: "Should revoked sessions stay in the table or be archived? Staying keeps the audit trail simple.",
    offset: -0.2,
  },
];

const ACTIVITY = [
  { projectId: PROJECTS[0]!.id, taskId: TASKS[1]!.id, actorId: MEMBERS[2]!.id, action: "task.moved", detail: 'Moved "Design new signup screens" to In progress', offset: -0.5 },
  { projectId: PROJECTS[0]!.id, taskId: TASKS[5]!.id, actorId: MEMBERS[2]!.id, action: "task.created", detail: 'Created "Fix mobile nav overflow"', offset: -1 },
  { projectId: PROJECTS[1]!.id, taskId: TASKS[7]!.id, actorId: MEMBERS[1]!.id, action: "comment.added", detail: 'Commented on "Add device session table"', offset: -0.2 },
  { projectId: PROJECTS[1]!.id, taskId: TASKS[7]!.id, actorId: MEMBERS[0]!.id, action: "task.moved", detail: 'Moved "Add device session table" to In progress', offset: -2 },
  { projectId: PROJECTS[1]!.id, taskId: TASKS[10]!.id, actorId: MEMBERS[3]!.id, action: "task.moved", detail: 'Moved "Record API walkthrough" to Done', offset: -2.5 },
  { projectId: PROJECTS[0]!.id, taskId: TASKS[0]!.id, actorId: MEMBERS[0]!.id, action: "task.moved", detail: 'Moved "Audit the current onboarding flow" to Done', offset: -5 },
  { projectId: PROJECTS[0]!.id, taskId: null, actorId: MEMBERS[0]!.id, action: "project.created", detail: 'Created project "Website relaunch"', offset: -9 },
  { projectId: PROJECTS[1]!.id, taskId: null, actorId: MEMBERS[1]!.id, action: "project.created", detail: 'Created project "Mobile API v2"', offset: -11 },
];

function iso(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString();
}

function dateOnly(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export function seedDatabase(db: Db, options: { force?: boolean } = {}): boolean {
  const existing = db.query("SELECT COUNT(*) AS count FROM projects").get() as {
    count: number;
  };
  if (existing.count > 0 && !options.force) return false;

  const insert = db.transaction(() => {
    db.exec(`
      DELETE FROM invites;
      DELETE FROM subscriptions;
      DELETE FROM activity;
      DELETE FROM comments;
      DELETE FROM tasks;
      DELETE FROM projects;
      DELETE FROM members;
    `);

    const memberStmt = db.query(
      `INSERT INTO members (id, name, email, role, avatar_color) VALUES (?, ?, ?, ?, ?)`,
    );
    for (const member of MEMBERS) {
      memberStmt.run(member.id, member.name, member.email, member.role, member.avatarColor);
    }

    const projectStmt = db.query(
      `INSERT INTO projects (id, name, slug, description, color, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const [index, project] of PROJECTS.entries()) {
      projectStmt.run(
        project.id,
        project.name,
        project.slug,
        project.description,
        project.color,
        iso(-10 + index),
      );
    }

    const taskStmt = db.query(
      `INSERT INTO tasks
         (id, project_id, title, description, status, priority, assignee_id, due_date, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const [index, task] of TASKS.entries()) {
      const createdAt = iso(-8 + index * 0.4);
      taskStmt.run(
        task.id,
        task.projectId,
        task.title,
        task.description,
        task.status,
        task.priority,
        task.assigneeId,
        task.dueOffset === null ? null : dateOnly(task.dueOffset),
        task.position,
        createdAt,
        createdAt,
      );
    }

    const commentStmt = db.query(
      `INSERT INTO comments (id, task_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
    );
    for (const comment of COMMENTS) {
      commentStmt.run(comment.id, comment.taskId, comment.authorId, comment.body, iso(comment.offset));
    }

    const activityStmt = db.query(
      `INSERT INTO activity (id, project_id, task_id, actor_id, action, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const [index, entry] of ACTIVITY.entries()) {
      activityStmt.run(
        `55555555-5555-4555-8555-5555555555${String(index).padStart(2, "0")}`,
        entry.projectId,
        entry.taskId,
        entry.actorId,
        entry.action,
        entry.detail,
        iso(entry.offset),
      );
    }
  });

  insert();
  return true;
}
