import type { Metadata } from "next";
import Copilot from "@/components/features/assistant/copilot";
import PageHeading from "@/components/ui/page-heading";
import { Chip } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { listAgentRuns } from "@/lib/db/agent-runs";
import { listCourses } from "@/lib/db/courses";
import { aiRuntimeStatus } from "@/lib/server/env";

export const metadata: Metadata = { title: "AI copilot" };

export default async function AssistantPage() {
  const { supabase } = await requirePageUser("/assistant");
  const [ai, runs, courses] = await Promise.all([aiRuntimeStatus(), listAgentRuns(supabase), listCourses(supabase)]);
  return (
    <>
      <PageHeading
        eyebrow="Your personal learning operator"
        title="AI copilot,"
        accent="on your side."
        accentColor="violet"
        description="The copilot reads your real deadlines, availability and course documents through permission-checked tools, cites the pages it used, and drafts a plan for you to review."
        actions={ai.kind === "scripted" ? <Chip tone="warn">Scripted test model · not AI</Chip> : ai.configured ? <Chip tone="good">Runtime: {ai.model}</Chip> : <Chip tone="warn">AI runtime not configured</Chip>}
      />
      <Copilot initialRuns={runs} courses={courses.map((c) => ({ id: c.id, title: c.title }))} runtime={{ configured: ai.configured, kind: ai.kind, model: ai.model }} />
    </>
  );
}
