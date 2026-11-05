import { describe, expect, it } from "vitest";
import { listMyOrganizations, joinOrganization } from "@/lib/org/service";
import type { ServerSupabase } from "@/lib/supabase/server";

/** A database without migration 0018: PostgREST answers PGRST205 (table) / PGRST202 (function). */
const missing = {
  from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: null, error: { code: "PGRST205", message: "Could not find the table 'public.memberships'" } }) }) }) }),
  rpc: async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function public.join_organization" } }),
} as unknown as ServerSupabase;

describe("organisations before the migration is applied", () => {
  it("the page gets null (shown as 'coming soon') instead of an error", async () => {
    expect(await listMyOrganizations(missing, "u1", Date.now())).toBeNull();
  });

  it("the API answers 503 not_available instead of 500", async () => {
    await expect(joinOrganization(missing, "ABCDEFGHJK")).rejects.toMatchObject({ status: 503, code: "not_available" });
  });
});
