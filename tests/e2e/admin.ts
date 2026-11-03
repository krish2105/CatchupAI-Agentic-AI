import { createClient } from "@supabase/supabase-js";

/** Test-only privileged client for arranging other tenants' data. Local stack only. */
export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("E2E admin helper is local-only");
  return createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
}

export async function createOtherTenant() {
  const db = adminDb();
  const email = `other-${Date.now().toString(36)}@test.catchup.local`;
  const { data: user, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  const ownerId = user.user.id;
  const { data: course } = await db.from("courses").insert({ owner_id: ownerId, title: "Private course of B" }).select("id").single();
  const { data: assignment } = await db
    .from("assignments")
    .insert({ owner_id: ownerId, course_id: course!.id, title: "B's secret assignment", due_at: new Date(Date.now() + 86400_000).toISOString(), estimated_minutes: 60 })
    .select("id")
    .single();
  return { ownerId, courseId: course!.id as string, assignmentId: assignment!.id as string, cleanup: () => db.auth.admin.deleteUser(ownerId) };
}
