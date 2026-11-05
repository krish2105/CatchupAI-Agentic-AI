import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acceptInvite, auditLog, createInvite, deleteOrganization, listInvites, removeMember, renameOrganization, resendInvite, revokeInvite, rotateJoinCode } from "@/lib/org/service";
import type { ServerSupabase } from "@/lib/supabase/server";
import { admin, deleteUser, signedInUser, type Db } from "./helpers";

type User = { id: string; email: string; db: Db };
let owner: User;
let invitee: User;
let stranger: User;
let org: string;
const s = (u: User) => u.db as unknown as ServerSupabase;
const err = async (p: Promise<unknown>) => p.then(() => null, (e: { status: number; code: string; message: string }) => e);

beforeAll(async () => {
  [owner, invitee, stranger] = await Promise.all(["inv-owner", "inv-invitee", "inv-stranger"].map((l) => signedInUser(l)));
  org = (await owner.db.rpc("create_organization", { p_name: "Invite school" })).data as string;
});
afterAll(async () => {
  await admin().from("organizations").delete().eq("id", org);
  await Promise.all([owner, invitee, stranger].filter(Boolean).map((u) => deleteUser(u.id)));
});

describe("email invitations", () => {
  it("only admins invite; the invitee must be signed in with that email; the link works once", async () => {
    expect(await err(createInvite(s(invitee), org, invitee.email, "student"))).toMatchObject({ status: 403 });
    const { token } = await createInvite(s(owner), org, invitee.email.toUpperCase(), "teacher");
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    expect(await err(acceptInvite(s(stranger), token))).toMatchObject({ status: 403, message: expect.stringMatching(/different email/) });
    expect(await acceptInvite(s(invitee), token)).toBe(org);
    const { data: m } = await admin().from("memberships").select("role").eq("org_id", org).eq("user_id", invitee.id).single();
    expect(m!.role).toBe("teacher");
    expect(await err(acceptInvite(s(invitee), token))).toMatchObject({ status: 404 });
  });

  it("stores only hashes and a masked email; admins see the list, nobody reads the table directly", async () => {
    const { data } = await admin().from("org_invites").select("email_hash, email_hint, token_hash").eq("org_id", org);
    expect(JSON.stringify(data)).not.toContain(invitee.email);
    expect(data![0].email_hint).toMatch(/^.•••@/);
    const list = await listInvites(s(owner), org);
    expect(list[0]).toMatchObject({ role: "teacher", accepted: true });
    expect(await err(listInvites(s(stranger), org))).toMatchObject({ status: 403 });
    for (const u of [owner, invitee, stranger]) expect((await u.db.from("org_invites").select("id")).data ?? []).toEqual([]);
  });

  it("a resend replaces the token; revoked and expired invites can't be used", async () => {
    const email = `late-${randomUUID().slice(0, 6)}@test.catchup.local`;
    const first = await createInvite(s(owner), org, email, "student");
    const fresh = await resendInvite(s(owner), first.inviteId);
    expect(fresh).not.toBe(first.token);
    await revokeInvite(s(owner), first.inviteId);
    expect(await err(revokeInvite(s(owner), first.inviteId))).toMatchObject({ status: 404 });

    const strangerInvite = await createInvite(s(owner), org, stranger.email, "student");
    await admin().from("org_invites").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", strangerInvite.inviteId);
    expect(await err(acceptInvite(s(stranger), strangerInvite.token))).toMatchObject({ status: 404, message: expect.stringMatching(/expired/) });
  });

  it("an invite can't get past a full organisation", async () => {
    const again = await createInvite(s(owner), org, stranger.email, "student");
    await admin().from("organizations").update({ seat_limit: 2 }).eq("id", org);
    expect(await err(acceptInvite(s(stranger), again.token))).toMatchObject({ status: 409, message: expect.stringMatching(/full/) });
    await admin().from("organizations").update({ seat_limit: 40 }).eq("id", org);
    expect(await acceptInvite(s(stranger), again.token)).toBe(org);
  });
});

describe("admin console", () => {
  it("admins remove members (not themselves); others can't", async () => {
    expect(await err(removeMember(s(invitee), org, stranger.id))).toMatchObject({ status: 403 });
    expect(await err(removeMember(s(owner), org, owner.id))).toMatchObject({ status: 400 });
    await removeMember(s(owner), org, stranger.id);
    expect((await admin().from("memberships").select("user_id").eq("org_id", org).eq("user_id", stranger.id)).data).toEqual([]);
  });

  it("rotating the code and renaming are admin-only and audited; the log can be filtered", async () => {
    expect(await err(renameOrganization(s(invitee), org, "Hijacked"))).toMatchObject({ status: 403 });
    await renameOrganization(s(owner), org, "Invite academy");
    const code = await rotateJoinCode(s(owner), org);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    const all = await auditLog(s(owner), org);
    expect(all.map((e) => e.action)).toEqual(expect.arrayContaining(["invite.created", "invite.accepted", "invite.resent", "invite.revoked", "member.removed", "org.renamed", "code.rotated"]));
    expect((await auditLog(s(owner), org, "org.renamed"))[0]).toMatchObject({ action: "org.renamed", detail: { from: "Invite school", to: "Invite academy" } });
    expect(await auditLog(s(invitee), org)).toEqual([]); // teachers don't read the audit log
  });

  it("deleting needs the exact name and no active paid plan; it removes the organisation, not anyone's study data", async () => {
    const course = (await invitee.db.from("courses").insert({ title: "Mine" }).select("id").single()).data!.id;
    expect(await err(deleteOrganization(s(owner), org, "Invite school"))).toMatchObject({ status: 400 });
    await admin().from("organizations").update({ plan: "class", plan_status: "active" }).eq("id", org);
    expect(await err(deleteOrganization(s(owner), org, "Invite academy"))).toMatchObject({ status: 409, message: expect.stringMatching(/cancel/i) });
    await admin().from("organizations").update({ plan: "free", plan_status: "canceled" }).eq("id", org);
    expect(await err(deleteOrganization(s(invitee), org, "Invite academy"))).toMatchObject({ status: 403 });
    await deleteOrganization(s(owner), org, "Invite academy");
    expect((await admin().from("organizations").select("id").eq("id", org)).data).toEqual([]);
    expect((await invitee.db.from("courses").select("id").eq("id", course)).data).toHaveLength(1);
  });
});
