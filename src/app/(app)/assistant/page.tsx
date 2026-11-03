import type { Metadata } from "next";
import Copilot from "@/components/features/assistant/copilot";
import PageHeading from "@/components/ui/page-heading";
import { Chip } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { listAgentRuns } from "@/lib/db/agent-runs";
import { listAssignments } from "@/lib/db/assignments";
import { listCourses } from "@/lib/db/courses";
import { RESCUE_PROMPT } from "@/lib/agents/prompts";
import { renderTime } from "@/lib/server/clock";
import { aiRuntimeStatus } from "@/lib/server/env";

export const metadata: Metadata = { title: "AI copilot" };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ rescue?: string }> }) {
  const { supabase } = await requirePageUser("/assistant");
  const [ai, runs, courses, assignments, params, now] = await Promise.all([aiRuntimeStatus(), listAgentRuns(supabase), listCourses(supabase), listAssignments(supabase), searchParams, renderTime()]);
  // Missed class rescue targets the course with the nearest upcoming required deadline.
  const urgent = assignments.filter((a) => a.required && a.status !== "completed" && Date.parse(a.dueAt) > now).sort((x, y) => Date.parse(x.dueAt) - Date.parse(y.dueAt))[0];
  const rescue = params.rescue === "1" ? { prompt: RESCUE_PROMPT, courseId: urgent?.courseId ?? null } : null;
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
      <Copilot initialRuns={runs} courses={courses.map((c) => ({ id: c.id, title: c.title }))} runtime={{ configured: ai.configured, kind: ai.kind, model: ai.model }} rescue={rescue} />
    </>
  );
}
