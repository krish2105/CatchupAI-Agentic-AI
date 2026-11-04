import Link from "next/link";
import { ArrowRight, BookOpenCheck, CalendarPlus, ListChecks, MessageSquareQuote, RefreshCcw, Scale, ShieldCheck } from "lucide-react";
import Brand from "@/components/shell/brand";
import ThemeButton from "@/components/shell/theme-button";
import PhotoHero from "@/components/nature/photo-hero";
import { ButtonLink } from "@/components/ui/primitives";
import DemoButton from "@/components/features/demo/demo-button";

const steps = [
  { n: "01", icon: BookOpenCheck, title: "Grounded in your lessons", body: "Upload course PDFs into a private vault. Answers cite the exact pages that were retrieved, or say they couldn't verify it." },
  { n: "02", icon: Scale, title: "Fit the work to real time", body: "Deadlines, estimates and weekly availability go through a deterministic feasibility engine: three honest routes, shortfalls shown in minutes." },
  { n: "03", icon: ShieldCheck, title: "You stay in control", body: "The copilot only drafts. Nothing is saved until you approve it, approval commits exactly once, and every plan explains why to trust it." },
];

const features = [
  { icon: RefreshCcw, title: "Missed a session? Replan from now", body: "Completed work is kept, missed time is rescheduled, and you approve the change." },
  { icon: MessageSquareQuote, title: "Teach it back", body: "Explain a topic in your own words; every key concept is checked against your notes and cited to its page." },
  { icon: ListChecks, title: "Rubric decoder", body: "Turn an assignment brief into an editable checklist of weighted criteria and requirements." },
  { icon: CalendarPlus, title: "Your plan, in your calendar", body: "Approved blocks sync to Google, Apple or Outlook with a private link you can revoke." },
];

export default function Home() {
  return (
    <div className="lp">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="lp-top">
        <Brand />
        <div className="top-actions">
          <ThemeButton />
          <ButtonLink href="/login" variant="primary" small>
            Sign in <ArrowRight className="ic" aria-hidden="true" />
          </ButtonLink>
        </div>
      </header>
      <main id="main">
        <PhotoHero labelledBy="hero-heading">
          <div className="eyebrow">Nature Flow · agentic learning recovery</div>
          <h1 id="hero-heading">Missed a lecture? Get back on track, realistically.</h1>
          <p>
            CatchUp AI connects your course notes, deadlines and the time you really have, then helps you choose a recovery plan that fits,
            with cited evidence and your approval before anything is saved.
          </p>
          <div className="nf-hero-actions">
            <ButtonLink href="/login" variant="primary">
              Get started <ArrowRight className="ic" aria-hidden="true" />
            </ButtonLink>
            <DemoButton className="btn" label="Try the demo, no sign-up" />
          </div>
        </PhotoHero>

        <section id="how-it-works" className="three-column lp-steps" aria-label="How CatchUp AI works">
          {steps.map(({ n, icon: Icon, title, body }) => (
            <article className="card" key={n}>
              <div className="split-head" style={{ marginBottom: 0 }}>
                <span className="step-number">{n}</span>
                <Icon className="ic" aria-hidden="true" style={{ color: "var(--aqua)" }} />
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </section>

        <section className="lp-features" aria-labelledby="features-head">
          <h2 id="features-head">Built for the week that went sideways</h2>
          <ul>
            {features.map(({ icon: Icon, title, body }) => (
              <li key={title} className="card">
                <span className="nf-stat-icon" aria-hidden="true"><Icon className="ic" /></span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-trust" aria-label="Security and evidence">
          <ShieldCheck className="ic" aria-hidden="true" />
          <p>
            Each student&apos;s data is isolated by row-level security, AI actions need your approval, and every release runs over 200 automated tests,
            including cross-account and prompt-injection checks.{" "}
            <a href="https://github.com/krish2105/CatchupAI-Agentic-AI/blob/main/SECURITY_AUDIT.md" target="_blank" rel="noopener noreferrer">Read the security audit</a>.
          </p>
        </section>
      </main>
      <footer className="lp-foot">
        <span>CatchUp AI · built for the Decoding Data Science Agentic AI Challenge, Nov 2026</span>
        <span className="lp-foot-links">
          <Link href="/quality">Quality and trust: tests, evaluation</Link>
          <Link href="/status">System status</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </span>
      </footer>
    </div>
  );
}
