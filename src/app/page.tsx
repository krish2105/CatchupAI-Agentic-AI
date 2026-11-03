import { ArrowRight, BookOpenCheck, Scale, ShieldCheck } from "lucide-react";
import Brand from "@/components/shell/brand";
import ThemeButton from "@/components/shell/theme-button";
import LandingOrb from "@/components/landing-orb";
import { ButtonLink } from "@/components/ui/primitives";

const steps = [
  { n: "01", icon: BookOpenCheck, title: "Grounded in your lessons", body: "Upload text-based course PDFs into a private vault. Answers cite the exact source pages that were retrieved — or say they couldn't verify it." },
  { n: "02", icon: Scale, title: "Fit the work to real time", body: "Deadlines, estimates and your weekly availability go through a deterministic feasibility engine. Three honest routes, with any shortfall shown in minutes." },
  { n: "03", icon: ShieldCheck, title: "You stay in control", body: "The agent only drafts proposals. Nothing is saved until you approve it, and approval commits exactly once." },
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
        <section className="hero lp-hero" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <div className="eyebrow">Agentic learning recovery</div>
            <h1 id="hero-heading">Make a little <em>room for progress.</em></h1>
            <p>
              CatchUp AI connects your course material, deadlines and available study time, then helps you choose a recovery plan that actually fits —
              with cited evidence and your approval before anything is saved.
            </p>
            <div className="hero-ctas">
              <ButtonLink href="/login" variant="primary">
                Get started <ArrowRight className="ic" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="#how-it-works" variant="ghost">How it works</ButtonLink>
            </div>
          </div>
          <div className="hero-visual">
            <LandingOrb />
            <div className="hud-hint"><i className="live-dot" /> ILLUSTRATION</div>
          </div>
        </section>

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
      </main>
      <footer className="lp-foot">
        <span>CatchUp AI · built for the Decoding Data Science Agentic AI Challenge, Nov 2026</span>
        <a href="/orbital-atelier-preview.html">Original design concept (simulated, no backend) ↗</a>
      </footer>
    </div>
  );
}
