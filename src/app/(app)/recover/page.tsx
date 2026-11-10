import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleDashed, FileText, Gauge, MessageSquareText, Route, Sparkles, Target, Timer } from "lucide-react";
import PageHeading from "@/components/ui/page-heading";
import { ButtonLink, Chip, EmptyCard } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { listDocuments } from "@/lib/db/documents";
import { getActivePlan } from "@/lib/db/tasks";
import { getMasteryMap, type MasteryMap } from "@/lib/mastery/service";
import { STATUS_LABEL } from "@/lib/mastery/elo";

export const metadata: Metadata = { title: "Start my recovery" };

const AGENT_LABEL: Record<string, string> = { coach: "Coach", diagnostician: "Diagnostician", quizmaster: "Quizmaster", night_coach: "Night Coach" };

type Step = { n: number; title: string; agent: string; icon: typeof Gauge; done: boolean; detail: string; href: string; cta: string };

/**
 * The guided recovery journey: one missed lecture, four steps, and which agent of the team does each one.
 * Status comes only from the student's own data (warm-up answers, the active plan, practice answers).
 */
export default async function RecoverPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const { supabase } = await requirePageUser("/recover");
  const [documents, plan, params] = await Promise.all([listDocuments(supabase), getActivePlan(supabase), searchParams]);
  const ready = documents.filter((d) => d.status === "ready");
  const doc = ready.find((d) => d.id === params.doc) ?? ready[0] ?? null;
  const map: MasteryMap | null = doc ? await getMasteryMap(supabase, doc.id).catch(() => null) : null;
  const { data: practiced } = doc
    ? await supabase.from("assessment_attempts").select("id, assessment_items!inner(document_id, mode)").eq("assessment_items.document_id", doc.id).neq("assessment_items.mode", "diagnostic").limit(1)
    : { data: [] };
  const { data: runs } = await supabase.from("agent_runs").select("id, agent, status, summary, request_text, created_at").order("created_at", { ascending: false }).limit(6);

  const tested = Boolean(map?.tested);
  const steps: Step[] = doc
    ? [
        {
          n: 1,
          title: "Find where you are",
          agent: "Diagnostician",
          icon: Gauge,
          done: tested,
          detail: tested ? `${map!.concepts.filter((c) => c.status === "known").length} of ${map!.concepts.length} concepts known` : "A 3-minute warm-up from this lecture's own pages",
          href: `/catch-up?doc=${doc.id}`,
          cta: tested ? "See your mastery map" : "Start the warm-up",
        },
        {
          n: 2,
          title: "Bridge the gaps",
          agent: "Coach",
          icon: MessageSquareText,
          done: false,
          detail: map?.bridge.length ? `Start with ${map.bridge.slice(0, 2).map((c) => `${c.concept} (${STATUS_LABEL[c.status].toLowerCase()})`).join(", ")}` : "Ask your Coach what to study first",
          href: "/assistant",
          cta: "Ask the Coach",
        },
        {
          n: 3,
          title: "Plan time that really fits",
          agent: "Planner",
          icon: Target,
          done: Boolean(plan),
          detail: plan ? `Active plan: ${plan.title}` : "Three routes; if none fits, why, and one next step",
          href: "/recovery",
          cta: plan ? "Open the Recovery lab" : "Plan my recovery",
        },
        {
          n: 4,
          title: "Practise until it sticks",
          agent: "Quizmaster",
          icon: Timer,
          done: Boolean(practiced?.length),
          detail: tested ? "Questions on your gaps, hints before answers; timed rehearsal is optional" : "Opens after the warm-up",
          href: `/catch-up?doc=${doc.id}`,
          cta: "Practise my gaps",
        },
      ]
    : [];

  return (
    <>
      <PageHeading
        eyebrow="Agent team"
        title="Start my recovery."
        description="One missed lecture, four steps. Each step is handled by an agent in your team, and nothing changes in your week until you approve it."
        actions={<ButtonLink href="/catch-up" small><FileText className="ic" aria-hidden="true" /> Choose another lecture</ButtonLink>}
      />
      {!doc ? (
        <EmptyCard icon={Route} title="Upload the lecture you missed" action={<ButtonLink href="/courses" variant="primary" small>Open the knowledge vault</ButtonLink>}>
          Add the slides, notes or transcript as a text-based PDF, then come back here to start.
        </EmptyCard>
      ) : (
        <>
          {ready.length > 1 ? (
            <nav className="pack-docs" aria-label="Missed lecture">
              {ready.slice(0, 6).map((d) => (
                <Link key={d.id} href={`/recover?doc=${d.id}`} className={`pack-doc${d.id === doc.id ? " active" : ""}`} aria-current={d.id === doc.id ? "page" : undefined}>
                  <FileText className="ic" aria-hidden="true" />
                  <span><b>{d.filename}</b><span>{d.pageCount} p.</span></span>
                </Link>
              ))}
            </nav>
          ) : null}
          <ol className="recover-steps" aria-label={`Recovery steps for ${doc.filename}`}>
            {steps.map((s) => (
              <li key={s.n} className={`card recover-step${s.done ? " done" : ""}`}>
                <div className="recover-step-head">
                  <span className="recover-step-n" aria-hidden="true">{s.n}</span>
                  <s.icon className="ic" aria-hidden="true" />
                  <h2>{s.title}</h2>
                  <Chip>{s.agent}</Chip>
                  {s.done ? <span className="recover-done"><CheckCircle2 className="ic" aria-hidden="true" /> Done</span> : <span className="recover-todo"><CircleDashed className="ic" aria-hidden="true" /> To do</span>}
                </div>
                <p>{s.detail}</p>
                <ButtonLink href={s.href} small variant={s.done ? undefined : "primary"}>{s.cta}</ButtonLink>
              </li>
            ))}
          </ol>
        </>
      )}

      <section className="card recover-team" aria-labelledby="team-head">
        <h2 id="team-head"><Sparkles className="ic" aria-hidden="true" /> What your agent team did recently</h2>
        {runs?.length ? (
          <ul>
            {runs.map((r) => (
              <li key={r.id}>
                <Chip tone={r.status === "failed" ? "danger" : undefined}>{AGENT_LABEL[r.agent as string] ?? "Coach"}</Chip>
                <span>{r.summary ?? r.request_text.slice(0, 90)}</span>
                <Link href={`/runs/${r.id}`}>Trace</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>No agent runs yet. Start with the warm-up above.</p>
        )}
      </section>
    </>
  );
}
