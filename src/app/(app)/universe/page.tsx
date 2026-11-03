import type { Metadata } from "next";
import PageHeading from "@/components/ui/page-heading";
import UniverseExplorer from "@/components/three/universe-explorer";
import { requirePageUser } from "@/lib/auth/session";
import { getOverview } from "@/lib/db/overview";

export const metadata: Metadata = { title: "Learning universe" };

export default async function UniversePage() {
  const { supabase } = await requirePageUser("/universe");
  const { graph } = await getOverview(supabase);
  return (
    <>
      <PageHeading
        eyebrow="Interactive knowledge ecosystem"
        title="Learning universe"
        description="Follow the paths connecting what you know to what comes next. Every island is one of your courses, coloured by your approved plan progress."
      />
      <UniverseExplorer graph={graph} />
    </>
  );
}
