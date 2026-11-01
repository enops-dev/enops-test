import type {
  Activity,
  Comment,
  Member,
  Priority,
  Project,
  Stats,
  Status,
  Task,
  TaskDetail,
} from "./types";

const API_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4101"
).replace(/\/$/, "");


export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      `Cannot reach the Taskline API at ${API_URL}. Start it with bun run dev:api.`,
      0,
    );
  }

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as {
        error?: string;
        message?: string;
        issues?: Array<{ message: string }>;
      };
      message =
        body.issues?.[0]?.message ??
        body.message ??
        body.error ??
        message;
    } catch {
      // Keep the status text.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export type TaskInput = {
  title?: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  assigneeId?: string | null;
  dueDate?: string | null;
  position?: number;
};

export type ProjectInput = {
  name: string;
  description?: string;
  color?: string;
};

export const api = {
  health: () => request<{ ok: boolean; service: string }>("/health"),

  projects: async () =>
    (await request<{ items: Project[] }>("/api/v1/projects")).items,

  createProject: (input: ProjectInput) =>
    request<Project>("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  members: async () =>
    (await request<{ items: Member[] }>("/api/v1/members")).items,

  tasks: async (projectId: string) =>
    (
      await request<{ items: Task[] }>(
        `/api/v1/projects/${projectId}/tasks`,
      )
    ).items,

  task: (taskId: string) => request<TaskDetail>(`/api/v1/tasks/${taskId}`),

  createTask: (projectId: string, input: TaskInput & { title: string }) =>
    request<Task>(`/api/v1/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateTask: (taskId: string, input: TaskInput) =>
    request<Task>(`/api/v1/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteTask: (taskId: string) =>
    request<void>(`/api/v1/tasks/${taskId}`, { method: "DELETE" }),

  addComment: (taskId: string, body: string, authorId?: string) =>
    request<Comment>(`/api/v1/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body, authorId }),
    }),

  stats: () => request<Stats>("/api/v1/stats"),

  activity: async (limit = 50) =>
    (
      await request<{ items: Activity[] }>(
        `/api/v1/activity?limit=${limit}`,
      )
    ).items,

};
