import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Db } from "./db";
import { env } from "./env";

const TTL_DAYS = 7;

type InviteClaims = { inviteId: string; projectId: string; email: string };

export type InviteRow = {
  id: string;
  project_id: string;
  email: string;
  role: "admin" | "member" | "viewer";
  invited_by: string | null;
  accepted_member_id: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export function createInvite(
  db: Db,
  input: { projectId: string; email: string; role: InviteRow["role"]; invitedBy: string | null },
) {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86_400_000).toISOString();
  db.query(
    `INSERT INTO invites (id, project_id, email, role, invited_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, input.projectId, input.email.toLowerCase(), input.role, input.invitedBy, expiresAt);

  const claims: InviteClaims = { inviteId: id, projectId: input.projectId, email: input.email };
  const token = jwt.sign(claims, env.inviteSecret, { expiresIn: `${TTL_DAYS}d` });
  return { id, token, link: `${env.appUrl}/invite?token=${encodeURIComponent(token)}`, expiresAt };
}

/** The invite a token points at, if the signature is valid and it is still open. */
export function readInvite(db: Db, token: string): InviteRow | null {
  let claims: InviteClaims;
  try {
    claims = jwt.verify(token, env.inviteSecret) as InviteClaims;
  } catch {
    return null;
  }
  const invite = db.query("SELECT * FROM invites WHERE id = ?").get(claims.inviteId) as InviteRow | null;
  if (!invite || invite.accepted_at || invite.project_id !== claims.projectId) return null;
  return invite;
}

export function acceptInvite(db: Db, invite: InviteRow, name: string) {
  const existing = db
    .query("SELECT id FROM members WHERE email = ?")
    .get(invite.email) as { id: string } | null;
  const memberId = existing?.id ?? randomUUID();

  db.transaction(() => {
    if (!existing) {
      db.query("INSERT INTO members (id, name, email, role) VALUES (?, ?, ?, ?)").run(
        memberId,
        name,
        invite.email,
        invite.role,
      );
    }
    db.query(
      "UPDATE invites SET accepted_at = datetime('now'), accepted_member_id = ? WHERE id = ?",
    ).run(memberId, invite.id);
  })();
  return memberId;
}
