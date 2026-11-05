import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { route } from "@/lib/http/errors";
import { auditLog } from "@/lib/org/service";
import { uuid } from "@/lib/validation/common";

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
  // Quote everything and neutralise spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** Admins download the organisation's audit log as CSV (RLS returns nothing to anyone else). */
export const GET = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { supabase } = await requireApiUser();
  const orgId = uuid.parse((await params).id);
  const action = new URL(request.url).searchParams.get("action") ?? undefined;
  const rows = await auditLog(supabase, orgId, action && /^[a-z._]{3,40}$/.test(action) ? action : undefined, 5000);
  const lines = [["time", "action", "actor", "target", "detail"].map(csvCell).join(","), ...rows.map((r) => [r.createdAt, r.action, r.actorId, r.targetUser, r.detail].map(csvCell).join(","))];
  return new NextResponse(lines.join("\r\n") + "\r\n", { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="audit-${orgId.slice(0, 8)}.csv"` } });
});
