const API = process.env.API_URL ?? "http://localhost:4101";

type Json = Record<string, unknown>;

async function request(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

console.log(`Smoke-testing ${API}\n`);

const health = await request("/health");
assert(health.ok, `GET /health returned ${health.status}`);
const healthBody = (await health.json()) as Json;
console.log(`✓ health: ${healthBody.service}`);

const projectsResponse = await request("/api/v1/projects");
assert(projectsResponse.ok, `GET /projects returned ${projectsResponse.status}`);
const projects = (await projectsResponse.json()) as { items: Json[] };
assert(projects.items.length > 0, "No projects returned");
const project = projects.items[0] as { id: string; name: string };
console.log(`✓ projects: ${projects.items.length} (using "${project.name}")`);

const createdResponse = await request(`/api/v1/projects/${project.id}/tasks`, {
  method: "POST",
  body: JSON.stringify({
    title: `Smoke test ${new Date().toISOString()}`,
    priority: "low",
    description: "Created by scripts/smoke.ts",
  }),
});
assert(createdResponse.status === 201, `Creating a task returned ${createdResponse.status}`);
const task = (await createdResponse.json()) as { id: string; title: string };
console.log(`✓ task created: ${task.id}`);

const movedResponse = await request(`/api/v1/tasks/${task.id}`, {
  method: "PATCH",
  body: JSON.stringify({ status: "in_progress" }),
});
assert(movedResponse.ok, `Moving the task returned ${movedResponse.status}`);
console.log("✓ task moved to in_progress");

const commentResponse = await request(`/api/v1/tasks/${task.id}/comments`, {
  method: "POST",
  body: JSON.stringify({ body: "Smoke test comment." }),
});
assert(commentResponse.status === 201, `Commenting returned ${commentResponse.status}`);
console.log("✓ comment added");

const detailResponse = await request(`/api/v1/tasks/${task.id}`);
const detail = (await detailResponse.json()) as { comments: unknown[] };
assert(detail.comments.length === 1, "Comment was not returned with the task");
console.log("✓ task detail includes the comment");

const statsResponse = await request("/api/v1/stats");
assert(statsResponse.ok, `GET /stats returned ${statsResponse.status}`);
const stats = (await statsResponse.json()) as { tasks: number };
console.log(`✓ stats: ${stats.tasks} tasks`);

const deleteResponse = await request(`/api/v1/tasks/${task.id}`, { method: "DELETE" });
assert(deleteResponse.status === 204, `Deleting the task returned ${deleteResponse.status}`);
console.log("✓ task deleted");

console.log("\nSmoke test passed.");
