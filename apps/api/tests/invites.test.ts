import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import jwt from "jsonwebtoken";
import { openDatabase, type Db } from "../src/db";
import { env } from "../src/env";
import { createInvite, readInvite } from "../src/invites";
import { seedDatabase } from "../src/seed";

const WEBSITE_PROJECT = "11111111-1111-4111-8111-111111111111";

let db: Db;

beforeEach(() => {
  db = openDatabase(":memory:");
  seedDatabase(db);
});

afterEach(() => {
  db.close();
});

describe("invite tokens (jsonwebtoken 9)", () => {
  test("a token issued by createInvite is accepted by readInvite", () => {
    const invite = createInvite(db, {
      projectId: WEBSITE_PROJECT,
      email: "new.person@taskline.dev",
      role: "member",
      invitedBy: null,
    });

    const row = readInvite(db, invite.token);
    expect(row?.id).toBe(invite.id);
    expect(row?.project_id).toBe(WEBSITE_PROJECT);
  });

  test("rejects an unsigned token (alg none)", () => {
    const invite = createInvite(db, {
      projectId: WEBSITE_PROJECT,
      email: "new.person@taskline.dev",
      role: "member",
      invitedBy: null,
    });
    const claims = jwt.decode(invite.token) as Record<string, unknown>;
    const unsigned = jwt.sign(claims, "", { algorithm: "none" as never });

    expect(readInvite(db, unsigned)).toBeNull();
  });

  test("rejects a token signed with an HMAC algorithm other than HS256", () => {
    const invite = createInvite(db, {
      projectId: WEBSITE_PROJECT,
      email: "new.person@taskline.dev",
      role: "member",
      invitedBy: null,
    });
    const claims = jwt.decode(invite.token) as Record<string, unknown>;
    const forged = jwt.sign(claims, env.inviteSecret, { algorithm: "HS512" });

    expect(readInvite(db, forged)).toBeNull();
  });
});
