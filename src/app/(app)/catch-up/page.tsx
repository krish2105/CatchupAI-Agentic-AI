import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, FileText, LifeBuoy } from "lucide-react";
import { AddToPlan, CheckQuestions, PackCheck } from "@/components/features/catchup/pack-actions";
import { catchupGains, packTopic } from "@/lib/catchup/gain";
import { getPracticeEvidence } from "@/lib/quiz/service";
import { renderTime } from "@/lib/server/clock";
import PageHeading from "@/components/ui/page-heading";
import ListenButton from "@/components/ui/listen-button";
import Thumbs from "@/components/ui/thumbs";
import { ButtonLink, EmptyCard, Notice } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/auth/session";
import { getCatchupPack } from "@/lib/catchup/service";
import { listCourses } from "@/lib/db/courses";
import { listDocuments } from "@/lib/db/documents";
import { ApiError } from "@/lib/http/errors";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Catch-up pack" };

export default async function CatchupPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const { supabase } = await requirePageUser("/catch-up");
  const [courses, documents, params] = await Promise.all([listCourses(supabase), listDocuments(supabase), searchParams]);
  const ready = documents.filter((d) => d.status === "ready");
  const titles = Object.fromEntries(courses.map((c) => [c.id, c.title]));
  const docId = params.doc && uuid.safeParse(params.doc).success ? params.doc : null;
  let result: Awaited<ReturnType<typeof getCatchupPack>> | null = null;
  let error: string | null = null;
  if (docId) {
    try {
      result = await getCatchupPack(supabase, docId);
    } catch (e) {
      error = e instanceof ApiError ? e.message : "This pack couldn't be built.";
    }
  }
  const pack = result?.pack;
  const evidence = result ? await getPracticeEvidence(supabase, await renderTime()) : null;
  const packGain = result ? catchupGains(evidence!.progress.filter((p) => p.courseId === result!.courseId && p.topic === packTopic(result!.filename)), { includePending: true })[0] ?? null : null;
  const listenText = pack
    ? `Catch-up pack for ${result!.filename}. Summary. ${pack.summary.map((s) => s.text).join(" ")} Key terms: ${pack.keyTerms.map((t) => t.term).join(", ")}.`
    : "";

  return (
    <>
      <PageHeading
        eyebrow="Missed a lecture?"
        title="Your catch-up pack."
        description="Pick the slides, notes or transcript of the lecture you missed. You'll get a cited summary, the key terms, five check questions and a 30-minute plan, built only from that document."
        actions={<ButtonLink href="/courses" small><BookOpen className="ic" aria-hidden="true" /> Upload lecture notes</ButtonLink>}
      />
      {ready.length === 0 ? (
        <EmptyCard icon={LifeBuoy} title="Upload the lecture you missed" action={<ButtonLink href="/courses" variant="primary" small>Open the knowledge vault</ButtonLink>}>
          Add the slides, notes or transcript as a text-based PDF in a course, then come back here.
        </EmptyCard>
      ) : (
        <nav className="pack-docs" aria-label="Lecture documents">
          {ready.map((d) => (
            <Link key={d.id} href={`/catch-up?doc=${d.id}`} className={`pack-doc${d.id === docId ? " active" : ""}`} aria-current={d.id === docId ? "page" : undefined}>
              <FileText className="ic" aria-hidden="true" />
              <span><b>{d.filename}</b><span>{titles[d.courseId] ?? "Course"} · {d.pageCount} p.</span></span>
            </Link>
          ))}
        </nav>
      )}
      {error ? <Notice tone="danger" title={error} /> : null}
      {pack && result ? (
        <article className="pack" aria-labelledby="pack-head">
          <header className="pack-head">
            <div>
              <div className="label">Catch-up pack · {pack.pages} page{pack.pages === 1 ? "" : "s"}</div>
              <h2 id="pack-head">{result.filename}</h2>
            </div>
            <ListenButton text={listenText} />
          </header>
          <div className="pack-grid">
            <section className="card pack-card" aria-labelledby="pack-summary">
              <h3 id="pack-summary">Summary</h3>
              <ul className="pack-summary">
                {pack.summary.map((s, i) => (
                  <li key={i}>{s.text} <a className="cite-chip" href={`/api/documents/${docId}/source?page=${s.page}`} target="_blank" rel="noopener noreferrer">p. {s.page}</a></li>
                ))}
              </ul>
            </section>
            <section className="card pack-card" aria-labelledby="pack-terms">
              <h3 id="pack-terms">Key terms</h3>
              <dl className="pack-terms">
                {pack.keyTerms.map((t) => (
                  <div key={t.term}><dt>{t.term} <span className="muted">p. {t.page}</span></dt><dd>{t.quote}</dd></div>
                ))}
              </dl>
            </section>
          </div>
          <section className="card pack-card" aria-labelledby="pack-check">
            <h3 id="pack-check">Check yourself</h3>
            {pack.questions.length ? <CheckQuestions questions={pack.questions} /> : <p className="muted">This document is too short for check questions.</p>}
          </section>
          <section className="card pack-card" aria-labelledby="pack-gain">
            <h3 id="pack-gain">Before and after</h3>
            <PackCheck courseId={result!.courseId} documentId={docId!} gain={packGain} />
          </section>
          <section className="card pack-card" aria-labelledby="pack-plan">
            <h3 id="pack-plan">A 30-minute catch-up</h3>
            <ol className="pack-plan">{pack.plan.map((b) => <li key={b.title}><b>{b.minutes} min</b> {b.title}</li>)}</ol>
            <AddToPlan documentId={docId!} />
          </section>
          <p className="muted pack-note">Built only from this document&apos;s text, without AI. Every point links to its page.</p>
          <Thumbs kind="pack" refId={docId!} question="Did this pack help you catch up?" />
        </article>
      ) : null}
    </>
  );
}
