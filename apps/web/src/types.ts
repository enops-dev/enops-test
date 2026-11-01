export type Status = "todo" | "in_progress" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";
export type View = "board" | "activity";

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

export type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor: string;
  createdAt: string;
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

export type Comment = {
  id: string;
  taskId: string;
  authorId: string | null;
  authorName: string | null;
  authorColor: string | null;
  body: string;
  createdAt: string;
};

export type Activity = {
  id: string;
  projectId: string;
  projectName: string | null;
  taskId: string | null;
  taskTitle: string | null;
  actorName: string | null;
  actorColor: string | null;
  action: string;
  detail: string;
  createdAt: string;
};

export type Stats = {
  tasks: number;
  done: number;
  completionRate: number;
  overdue: number;
  byStatus: Record<Status, number>;
  byPriority: Record<Priority, number>;
  comments: number;
  members: number;
};

export type TaskDetail = Task & { comments: Comment[] };
