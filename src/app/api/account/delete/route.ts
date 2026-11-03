import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { ApiError, readJson, route } from "@/lib/http/errors";
import { adminClient } from "@/lib/supabase/admin";

const body = z.object({ confirm: z.literal("DELETE") }).strict();

/**
 * Permanently deletes the signed-in student's account: their private files, then the auth user (all rows
 * cascade via foreign keys). Requires the typed confirmation "DELETE". Identity comes only from the session.
 */
export const POST = route(async (request: Request) => {
  const { supabase, user } = await requireApiUser();
  body.parse(await readJson(request));
  const admin = adminClient();
  const { data: docs } = await supabase.from("documents").select("storage_path");
  const paths = (docs ?? []).map((d) => d.storage_path).filter((p): p is string => typeof p === "string" && p.startsWith(`${user.id}/`));
  if (paths.length) await admin.storage.from("course-documents").remove(paths);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw new ApiError(500, "delete_failed", "Your account couldn't be deleted. Nothing was removed from your sign-in.", error.message);
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  return NextResponse.json({ deleted: true });
});
