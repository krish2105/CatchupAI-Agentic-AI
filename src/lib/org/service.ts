import "server-only";
import { z } from "zod";
import { ApiError, fromDbError, isMissingSchema } from "@/lib/http/errors";
import type { ServerSupabase } from "@/lib/supabase/server";
import { orgBilling, type OrgBilling } from "@/lib/billing/service";

/**
 * Organisations (institutions/classes). Every write is a database function that checks the caller's role
 * (supabase/migrations/…18_organizations.sql); this module only maps their errors to clear messages. Staff see
 * a roster (name, role, sharing) and class aggregates from consenting students, never anyone's study data.
 */
export const orgName = z.object({ name: z.string().trim().min(2).max(120) }).strict();
export const joinCode = z.object({ code: z.string().trim().regex(/^[A-Za-z0-9]{10}$/, "A join code has 10 letters and digits.") }).strict();
export const shareBody = z.object({ share: z.boolean() }).strict();
export const roleBody = z.object({ userId: z.uuid(), role: z.enum(["student", "teacher", "admin"]) }).strict();

const MESSAGES: Record<string, { status: number; code: string; message: string }> = {
  "invalid join code": { status: 404, code: "not_found", message: "That code doesn't match an organisation." },
  "invite not found": { status: 404, code: "invite_invalid", message: "This invite link isn't valid any more. Ask for a new one." },
  "invite already used": { status: 404, code: "invite_used", message: "This invite was already used." },
  "invite expired": { status: 404, code: "invite_expired", message: "This invite has expired. Ask the admin to resend it." },
  "invite is for another email": { status: 403, code: "invite_other_email", message: "This invite is for a different email address. Sign in with the address it was sent to." },
  "organisation is full": { status: 409, code: "org_full", message: "This organisation is full. Ask an admin to free a seat or upgrade the plan." },
  "make another member admin before leaving": { status: 409, code: "conflict", message: "Make another member an admin before you leave." },
  "an organisation needs an admin": { status: 409, code: "conflict", message: "An organisation needs at least one admin." },
  "cancel the paid plan first": { status: 409, code: "paid_plan_active", message: "Cancel the paid plan in Manage billing before deleting the organisation." },
  "too many open invites": { status: 409, code: "conflict", message: "There are 200 open invites. Revoke some before sending more." },
  "name does not match": { status: 400, code: "confirm_mismatch", message: "Type the organisation's exact name to confirm." },
  "use leave to remove yourself": { status: 400, code: "invalid", message: "To remove yourself, use Leave." },
  "invalid email": { status: 400, code: "invalid", message: "Enter a valid email address." },
  "invalid name": { status: 400, code: "invalid", message: "A name needs 2 to 120 characters." },
};

function rpcError(error: { code?: string; message?: string }): ApiError {
  if (isMissingSchema(error)) return new ApiError(503, "not_available", "Organisations aren't available yet. Please try again later.");
  const known = MESSAGES[error.message ?? ""];
  if (known) return new ApiError(known.status, known.code, known.message);
  if (error.code === "P0002") return new ApiError(404, "not_found", "Not found.");
  if (error.code === "23514") return new ApiError(409, "conflict", "You've reached the limit of 5 organisations.");
  if (error.code === "42501") return new ApiError(403, "forbidden", /demo accounts/.test(error.message ?? "") ? "Demo accounts can't join organisations. Sign in with your email first." : "You don't have access to that.");
  return fromDbError(error);
}

async function call<T>(p: PromiseLike<{ data: T; error: { code?: string; message?: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw rpcError(error);
  return data;
}

export const createOrganization = (s: ServerSupabase, name: string) => call(s.rpc("create_organization", { p_name: name }));
export const joinOrganization = (s: ServerSupabase, code: string) => call(s.rpc("join_organization", { p_code: code }));
export const setShareProgress = (s: ServerSupabase, org: string, share: boolean) => call(s.rpc("set_share_progress", { p_org: org, p_share: share }));
export const leaveOrganization = (s: ServerSupabase, org: string) => call(s.rpc("leave_organization", { p_org: org }));
export const setMemberRole = (s: ServerSupabase, org: string, userId: string, role: string) => call(s.rpc("set_member_role", { p_org: org, p_user: userId, p_role: role }));

export type OrgSummary = { members: number; students: number; sharing: number; shown: boolean; blocks_completed: number | null; minutes_completed: number | null; assignments_due_7d: number | null; overdue_assignments: number | null; avg_latest_quiz: number | null };
export type RosterEntry = { user_id: string; display_name: string; role: string; share_progress: boolean };
export type OrgView = {
  id: string;
  name: string;
  role: "student" | "teacher" | "admin";
  shareProgress: boolean;
  staff: null | { joinCode: string; roster: RosterEntry[]; summary: OrgSummary; billing: OrgBilling | null; invites: InviteEntry[] | null; audit: AuditEntry[] | null };
};

/**
 * The signed-in user's organisations, with the staff view (code, roster, last-7-day aggregates) where they're
 * staff. null when this database doesn't have the organisation tables yet (migration 0018 not applied).
 */
export async function listMyOrganizations(supabase: ServerSupabase, userId: string, now: number): Promise<OrgView[] | null> {
  const { data, error } = await supabase.from("memberships").select("org_id, role, share_progress, organizations(name)").eq("user_id", userId).order("created_at");
  if (isMissingSchema(error)) return null;
  if (error) throw fromDbError(error);
  const since = new Date(now - 7 * 86400_000).toISOString();
  return Promise.all(
    data.map(async (m) => {
      const role = m.role as OrgView["role"];
      const base = { id: m.org_id, name: (m.organizations as unknown as { name: string }).name, role, shareProgress: m.share_progress };
      if (role === "student") return { ...base, staff: null };
      const [joinCode, roster, summary] = await Promise.all([
        call(supabase.rpc("organization_join_code", { p_org: m.org_id })),
        call(supabase.rpc("org_members", { p_org: m.org_id })),
        call(supabase.rpc("org_class_summary", { p_org: m.org_id, p_since: since })),
      ]);
      // Plan, seats and renewal for admins only (org_billing refuses everyone else).
      const isAdmin = role === "admin";
      // Admin-only extras; each is null if this database doesn't have it yet (e.g. migration 0020 not applied).
      const [billing, invites, audit] = isAdmin
        ? await Promise.all([orgBilling(supabase, m.org_id).catch(() => null), listInvites(supabase, m.org_id, now).catch(() => null), auditLog(supabase, m.org_id, undefined, 50).catch(() => null)])
        : [null, null, null];
      return { ...base, staff: { joinCode: joinCode as string, roster: roster as RosterEntry[], summary: (summary as OrgSummary[])[0], billing, invites, audit } };
    }),
  );
}

// Invitations (migration 0020). Tokens are returned once to the server; only their hashes are stored.
export const inviteBody = z.object({ email: z.email().max(254), role: z.enum(["student", "teacher", "admin"]) }).strict();
export const tokenBody = z.object({ token: z.string().trim().regex(/^[0-9a-f]{48}$/, "That invite link is incomplete.") }).strict();
export const confirmBody = z.object({ confirmName: z.string().trim().min(2).max(120) }).strict();

export async function createInvite(s: ServerSupabase, org: string, email: string, role: string) {
  const rows = (await call(s.rpc("create_org_invite", { p_org: org, p_email: email, p_role: role }))) as { invite_id: string; token: string }[];
  return { inviteId: rows[0].invite_id, token: rows[0].token };
}
export const resendInvite = async (s: ServerSupabase, invite: string) => (await call(s.rpc("resend_org_invite", { p_invite: invite }))) as string;
export const revokeInvite = (s: ServerSupabase, invite: string) => call(s.rpc("revoke_org_invite", { p_invite: invite }));
export const acceptInvite = async (s: ServerSupabase, token: string) => (await call(s.rpc("accept_org_invite", { p_token: token }))) as string;

export type InviteEntry = { id: string; emailHint: string; role: string; createdAt: string; expiresAt: string; accepted: boolean; revoked: boolean; expired: boolean };
export async function listInvites(s: ServerSupabase, org: string, now = Date.now()): Promise<InviteEntry[]> {
  const rows = (await call(s.rpc("org_invite_list", { p_org: org }))) as { id: string; email_hint: string; role: string; created_at: string; expires_at: string; accepted_at: string | null; revoked_at: string | null }[];
  return rows.map((r) => ({ id: r.id, emailHint: r.email_hint, role: r.role, createdAt: r.created_at, expiresAt: r.expires_at, accepted: Boolean(r.accepted_at), revoked: Boolean(r.revoked_at), expired: !r.accepted_at && Date.parse(r.expires_at) <= now }));
}

// Admin console.
export const removeMember = (s: ServerSupabase, org: string, userId: string) => call(s.rpc("remove_org_member", { p_org: org, p_user: userId }));
export const renameOrganization = (s: ServerSupabase, org: string, name: string) => call(s.rpc("rename_organization", { p_org: org, p_name: name }));
export const deleteOrganization = (s: ServerSupabase, org: string, confirmName: string) => call(s.rpc("delete_organization", { p_org: org, p_confirm_name: confirmName }));
export const rotateJoinCode = async (s: ServerSupabase, org: string) => (await call(s.rpc("rotate_join_code", { p_org: org }))) as string;

export type AuditEntry = { id: number; action: string; actorId: string | null; targetUser: string | null; detail: Record<string, unknown>; createdAt: string };
/** The organisation's audit log, newest first (admins only: RLS returns nothing to anyone else). */
export async function auditLog(s: ServerSupabase, org: string, action?: string, limit = 200): Promise<AuditEntry[]> {
  let q = s.from("org_audit_events").select("id, action, actor_id, target_user, detail, created_at").eq("org_id", org).order("id", { ascending: false }).limit(limit);
  if (action) q = q.eq("action", action);
  const { data, error } = await q;
  if (error) throw rpcError(error);
  return data.map((r) => ({ id: r.id, action: r.action, actorId: r.actor_id, targetUser: r.target_user, detail: r.detail as Record<string, unknown>, createdAt: r.created_at }));
}

