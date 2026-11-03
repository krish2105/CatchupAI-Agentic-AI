import AgentOrb from "@/components/agent-orb";
import PlannerPreview from "@/components/planner-preview";
import ThemeToggle from "@/components/theme-toggle";

const steps = [
  {
    number: "01",
    eyebrow: "KNOW",
    title: "Grounded in your lessons",
    description:
      "Build a private knowledge base from course PDFs and assignments, then cite the exact source pages that inform responses.",
  },
  {
    number: "02",
    eyebrow: "PLAN",
    title: "Fit the work to real time",
    description:
      "Combine actual deadlines and study capacity. Detect overload and propose priorities before recommending a schedule.",
  },
  {
    number: "03",
    eyebrow: "ACT",
    title: "You stay in control",
    description:
      "Review and approve study tasks explicitly. See the agent's true tool activity and track completed work.",
  },
];

export default function Home() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="#home" className="brand" aria-label="CatchUp AI home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>catchup<span className="brand-ai">.ai</span></span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#how-it-works">How it works</a>
          <a href="/orbital-atelier-preview.html" target="_blank" rel="noopener noreferrer">Interactive design</a>
          <ThemeToggle />
        </nav>
      </header>

      <main id="home">
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <div className="pill"><span className="live-dot" /> HACKATHON PRODUCT CONCEPT · NOV 2026</div>
            <h1 id="hero-heading">Make a little<br /><span>room for progress.</span></h1>
            <p className="hero-deck">
              An academic recovery mission control, where every lesson has a place, every plan respects your time, and you approve every action.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="/orbital-atelier-preview.html" target="_blank" rel="noopener noreferrer">Open nine-screen UI demo <span aria-hidden="true">↗</span></a>
              <a className="btn btn-secondary" href="#how-it-works">See the workflow <span aria-hidden="true">↓</span></a>
            </div>
            <div className="trust-line">
              <span className="trust-mark" aria-hidden="true">✦</span>
              Built around real agent tools, verified sources and human-approved actions.
            </div>
          </div>
          <div className="hero-visual">
            <AgentOrb />
            <div className="orbit-label orbit-label-top"><span className="node node-cyan" /> KNOWLEDGE</div>
            <div className="orbit-label orbit-label-middle"><span className="node node-purple" /> AI REASONING</div>
            <div className="orbit-label orbit-label-bottom"><span className="node node-warm" /> RECOVERY PLAN</div>
          </div>
        </section>

        <section className="principle-bar" aria-label="Product promises">
          <div><span>01</span> Evidence first</div>
          <i aria-hidden="true" />
          <div><span>02</span> Feasible planning</div>
          <i aria-hidden="true" />
          <div><span>03</span> Approval before action</div>
        </section>

        <section className="section-block" id="how-it-works" aria-labelledby="how-heading">
          <div className="section-head">
            <div>
              <div className="section-kicker">THE AUTONOMOUS RECOVERY LOOP</div>
              <h2 id="how-heading">Not another chatbot.<br /><span>A system that helps you act.</span></h2>
            </div>
            <p>The agent can investigate a real problem, gather supporting evidence, draft a prioritized recovery path and wait for your approval.</p>
          </div>
          <div className="steps">
            {steps.map((step) => (
              <article className="step-card" key={step.number}>
                <div className="step-top"><span className="step-number">{step.number}</span><span>{step.eyebrow}</span></div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="preview-grid" id="preview" aria-label="Interactive visual concept preview">
          <div className="preview-copy">
            <div className="section-kicker">WHY THIS MATTERS</div>
            <h2>Less panic.<br /><span>More progress.</span></h2>
            <p>CatchUp AI is designed to calculate study capacity before making commitments. A polished interface should show honest trade-offs, not just AI-generated optimism.</p>
            <div className="preview-tag"><span aria-hidden="true">◈</span> Live planning calculation below uses fictional data.</div>
          </div>
          <PlannerPreview />
        </section>

        <section className="status-strip" aria-label="Development status">
          <span className="status-icon" aria-hidden="true">i</span>
          <div>
            <strong>This is the honest starter preview.</strong>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="brand"><span className="brand-mark" aria-hidden="true"><span /></span><span>catchup<span className="brand-ai">.ai</span></span></div>
        <span>Prototype starter · Synthetic data only · No backend claims</span>
      </footer>
    </div>
  );
}
