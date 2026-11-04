import type { Metadata } from "next";
import OrgPanel from "@/components/features/org/org-panel";
import PageHeading from "@/components/ui/page-heading";
import { requirePageUser } from "@/lib/auth/session";
import { listMyOrganizations } from "@/lib/org/service";
import { renderTime } from "@/lib/server/clock";

export const metadata: Metadata = { title: "Organisations" };

/** Schools and classes: join with a code, choose whether to count in class totals, and (staff) see aggregates. */
export default async function OrgPage() {
  const { supabase, user } = await requirePageUser("/org");
  const anonymous = Boolean((user as { is_anonymous?: boolean }).is_anonymous);
  const orgs = anonymous ? [] : await listMyOrganizations(supabase, user.id, await renderTime());
  return (
    <>
      <PageHeading
        eyebrow="Your school or class"
        title="Learn together,"
        accent="keep your notes private."
        description="Join your class with the code your teacher gives you. Teachers see class totals only, never your notes, answers or plans, and only if you choose to share."
      />
      <OrgPanel orgs={orgs} anonymous={anonymous} />
    </>
  );
}
