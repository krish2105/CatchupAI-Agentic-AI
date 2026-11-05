import { ArrowRight, Check, Circle } from "lucide-react";
import Link from "next/link";
import { activationProgress, type ActivationFacts } from "@/lib/activation/steps";

/** Mission Control checklist: real progress towards the first finished study block; hidden once all steps are done. */
export default function GettingStarted({ facts }: { facts: ActivationFacts }) {
  const p = activationProgress(facts);
  if (p.complete) return null;
  return (
    <section className="card card-inner getting-started section-space" aria-labelledby="getting-started-title">
      <div className="split-head">
        <h2 id="getting-started-title" className="trace-h2">Getting started</h2>
        <span className="muted">{p.done} of {p.total} done</span>
      </div>
      <progress className="getting-started-bar" max={p.total} value={p.done} aria-label={`${p.done} of ${p.total} getting-started steps done`} />
      {p.activated ? <p className="muted">You&apos;re recovering on a plan you chose. The remaining steps are optional extras.</p> : null}
      <ol className="getting-started-steps">
        {p.steps.map((s) => (
          <li key={s.id} data-done={s.done}>
            {s.done ? <Check className="ic" aria-hidden="true" /> : <Circle className="ic" aria-hidden="true" />}
            {s.done ? <span>{s.title}<span className="visually-hidden"> (done)</span></span> : <Link href={s.href}>{s.title}</Link>}
          </li>
        ))}
      </ol>
      {p.next ? <Link className="btn small primary" href={p.next.href}>Next: {p.next.title} <ArrowRight className="ic" aria-hidden="true" /></Link> : null}
    </section>
  );
}
