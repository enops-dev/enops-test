import type { Db } from "./db";
import { env } from "./env";
import { configured, resend } from "./vendors";

type SendResult = { sent: boolean; id?: string; error?: string };

function escape(text: string) {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function layout(heading: string, body: string, action?: { label: string; url: string }) {
  const button = action
    ? `<p><a href="${action.url}" style="background:#18181b;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${escape(action.label)}</a></p>`
    : "";
  return `<div style="font-family:system-ui,sans-serif;max-width:520px"><h2>${escape(heading)}</h2>${body}${button}<p style="color:#71717a;font-size:12px">Taskline</p></div>`;
}

async function send(to: string, subject: string, html: string): Promise<SendResult> {
  if (!configured().email) return { sent: false, error: "Email is not configured" };
  const { data, error } = await resend.emails.send({ from: env.emailFrom, to, subject, html });
  if (error) return { sent: false, error: error.message };
  return { sent: true, id: data?.id };
}

export function sendAssignmentEmail(
  member: { name: string; email: string },
  task: { id: string; title: string; dueDate: string | null },
) {
  const due = task.dueDate ? `<p>Due ${escape(task.dueDate)}.</p>` : "";
  return send(
    member.email,
    `You were assigned: ${task.title}`,
    layout(`Hi ${member.name}, this one is yours`, `<p>${escape(task.title)}</p>${due}`, {
      label: "Open task",
      url: `${env.appUrl}/tasks/${task.id}`,
    }),
  );
}

export function sendInviteEmail(email: string, projectName: string, link: string) {
  return send(
    email,
    `You're invited to ${projectName} on Taskline`,
    layout(`Join ${projectName}`, "<p>The invite expires in 7 days.</p>", {
      label: "Accept invite",
      url: link,
    }),
  );
}

type DigestRow = { name: string; email: string; open: number; overdue: number; done_this_week: number };

/** One email per member with open work: what is due, what is late, what shipped. */
export async function sendWeeklyDigest(db: Db) {
  const rows = db
    .query(
      `SELECT m.name, m.email,
         SUM(CASE WHEN t.status != 'done' THEN 1 ELSE 0 END) AS open,
         SUM(CASE WHEN t.status != 'done' AND t.due_date < date('now') THEN 1 ELSE 0 END) AS overdue,
         SUM(CASE WHEN t.status = 'done' AND t.updated_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS done_this_week
       FROM members m JOIN tasks t ON t.assignee_id = m.id
       GROUP BY m.id HAVING open > 0 ORDER BY m.name`,
    )
    .all() as DigestRow[];

  if (!configured().email) return { recipients: rows.length, sent: 0 };

  const { data, error } = await resend.batch.send(
    rows.map((row) => ({
      from: env.emailFrom,
      to: row.email,
      subject: `Your week in Taskline: ${row.open} open, ${row.overdue} overdue`,
      html: layout(
        `Hi ${row.name}`,
        `<p>${row.open} open · ${row.overdue} overdue · ${row.done_this_week} done this week</p>`,
        { label: "Open my tasks", url: env.appUrl },
      ),
    })),
  );
  if (error) throw new Error(`Weekly digest failed: ${error.message}`);
  return { recipients: rows.length, sent: data?.data.length ?? 0 };
}
