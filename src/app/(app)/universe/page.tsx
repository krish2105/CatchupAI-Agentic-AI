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
        eyebrow="The living knowledge map"
        title="Explore your"
        accent="learning universe."
        description="Drag or use the arrow keys to rotate. Every world is one of your courses; its colour reflects your approved plan progress. Choose one to inspect it."
      />
      <UniverseExplorer graph={graph} />
    </>
  );
}
