import { z } from "zod";
import type { Db } from "./db";
import { env } from "./env";
import { openai } from "./vendors";

const SYSTEM = [
  "You help a small product team keep their task board readable.",
  "Be concrete and short. Never invent facts that are not in the task or its comments.",
].join(" ");

const subtaskList = z.object({
  subtasks: z.array(z.string().trim().min(1).max(200)).max(8),
});

/** Two or three sentences on where a task stands, from its description and comments. */
export async function summarizeTask(db: Db, taskId: string) {
  const task = db
    .query("SELECT title, description, status, priority, due_date FROM tasks WHERE id = ?")
    .get(taskId) as
    | { title: string; description: string; status: string; priority: string; due_date: string | null }
    | null;
  if (!task) return null;

  const comments = db
    .query(
      `SELECT m.name AS author, c.body FROM comments c
       LEFT JOIN members m ON m.id = c.author_id
       WHERE c.task_id = ? ORDER BY c.created_at ASC LIMIT 30`,
    )
    .all(taskId) as Array<{ author: string | null; body: string }>;

  const thread = comments.map((c) => `${c.author ?? "Someone"}: ${c.body}`).join("\n");
  const completion = await openai.chat.completions.create({
    model: env.openaiModel,
    temperature: 0.2,
    max_tokens: 220,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          `Task: ${task.title} (${task.status}, ${task.priority} priority, due ${task.due_date ?? "—"})`,
          task.description && `Description: ${task.description}`,
          thread && `Comments:\n${thread}`,
          "Summarize where this task stands and what is blocking it.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  });

  return {
    summary: completion.choices[0]?.message.content?.trim() ?? "",
    model: completion.model,
  };
}

/** Breaks a task title into a short checklist. */
export async function suggestSubtasks(title: string, description = "") {
  const completion = await openai.chat.completions.create({
    model: env.openaiModel,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `${SYSTEM} Reply with JSON: {"subtasks": string[]}.` },
      { role: "user", content: `Split this into 3-6 subtasks.\n\n${title}\n\n${description}` },
    ],
  });

  const raw = completion.choices[0]?.message.content ?? "{}";
  const parsed = subtaskList.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data.subtasks : [];
}
