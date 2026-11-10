"use client";

import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

/** The judge's path through the product, one real screen per stop (synthetic demo data). */
export const TOUR = [
  { href: "/dashboard", title: "Mission control", body: "The week at a glance: deadlines, study capacity and whether the balanced recovery route fits. Every number is computed from the account's data." },
  { href: "/assistant", title: "Missed class rescue", body: "The copilot reads deadlines, availability and notes through permission-checked tools, cites the pages it used and drafts a plan. It can't save anything itself." },
  { href: "/recovery", title: "Recovery lab", body: "Three deterministic routes. Drag the weekly-time slider to watch feasibility change; routes that don't fit can't be approved. Review the exact changes, then approve once." },
  { href: "/planner", title: "Study schedule", body: "Approved blocks become a calendar in the student's time zone. Missed sessions trigger a replan, and the plan exports to Google or Apple Calendar with a private link." },
  { href: "/quizzes", title: "Teach it back", body: "Explain “residuals” in your own words: each key concept is checked against the notes and cited to its page, and missed concepts become a targeted retest." },
  { href: "/courses", title: "Knowledge vault", body: "Private PDFs with page-cited search. Open the course to try syllabus import and the rubric decoder, which turns a brief into a checklist." },
  { href: "/universe", title: "Learning universe", body: "Each course is a 3D island coloured by plan progress, with a list view and keyboard controls as accessible alternatives." },
  { href: "/focus", title: "Focus sanctuary", body: "Timed sessions are saved to the student's history, can complete a plan block, and survive a refresh or dropped connection." },
  { href: "/insights", title: "Trust by design", body: "Every student's data is isolated by row-level security, AI actions need human approval, and over 200 automated tests guard it. That's the tour: thanks for looking." },
] as const;

const KEY = "catchup:tour";
const EVENT = "catchup:tour";
type TourState = { step: number; open: boolean };

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
function write(state: TourState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private mode: the tour still works for this page view via the event below.
  }
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Opens the tour at the first stop (used by the demo banner). */
export function startTour() {
  write({ step: 0, open: true });
}

/** Floating guide for demo accounts. Opens automatically the first time; position is remembered. */
export default function GuidedTour() {
  const router = useRouter();
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribe, read, () => "server");
  if (raw === "server") return null;
  const state: TourState = raw ? (JSON.parse(raw) as TourState) : { step: 0, open: true };
  const step = Math.min(Math.max(state.step, 0), TOUR.length - 1);
  const stop = TOUR[step];
  const here = pathname === stop.href || pathname.startsWith(`${stop.href}/`);

  const go = (next: number) => {
    write({ step: next, open: true });
    router.push(TOUR[next].href);
  };

  if (!state.open) {
    return (
      <button type="button" className="tour-pill" onClick={() => write({ step, open: true })}>
        <Compass className="ic" aria-hidden="true" /> Resume tour ({step + 1}/{TOUR.length})
      </button>
    );
  }
  return (
    <section className="tour-panel" aria-labelledby="tour-title" aria-live="polite">
      <div className="tour-top">
        <span className="tour-count">Guided tour · {step + 1} of {TOUR.length}</span>
        <button type="button" className="icon-btn" aria-label="Close the tour" onClick={() => write({ step, open: false })}><X className="ic" aria-hidden="true" /></button>
      </div>
      <h2 id="tour-title">{stop.title}</h2>
      <p>{stop.body}</p>
      <div className="tour-progress" aria-hidden="true">{TOUR.map((t, i) => <i key={t.href} className={i <= step ? "on" : undefined} />)}</div>
      <div className="tour-actions">
        <button type="button" className="btn small ghost" onClick={() => go(step - 1)} disabled={step === 0}><ArrowLeft className="ic" aria-hidden="true" /> Back</button>
        {!here ? (
          <button type="button" className="btn small" onClick={() => router.push(stop.href)}>Show me</button>
        ) : null}
        {step < TOUR.length - 1 ? (
          <button type="button" className="btn small primary" onClick={() => go(step + 1)}>Next: {TOUR[step + 1].title} <ArrowRight className="ic" aria-hidden="true" /></button>
        ) : (
          <button type="button" className="btn small primary" onClick={() => write({ step: 0, open: false })}>Finish tour</button>
        )}
      </div>
    </section>
  );
}
