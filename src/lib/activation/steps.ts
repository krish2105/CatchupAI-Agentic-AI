/**
 * Activation (pure, client-safe). The "aha" moment for CatchUp AI is the first finished study block of an
 * approved plan: the student has gone from "I missed class" to recovering on a schedule they chose. The checklist
 * walks there in the order that gets a new student to it fastest; every step is read from real rows, nothing is
 * tracked separately.
 */
export type ActivationFacts = { courses: number; readyDocuments: number; assignments: number; approvedPlans: number; completedBlocks: number; copilotRuns: number; quizAttempts: number };

export const ACTIVATION_STEPS = [
  { id: "course", title: "Add a course", href: "/courses", done: (f: ActivationFacts) => f.courses > 0 },
  { id: "deadline", title: "Add or import a deadline", href: "/courses", done: (f: ActivationFacts) => f.assignments > 0 },
  { id: "notes", title: "Upload lecture notes", href: "/courses", done: (f: ActivationFacts) => f.readyDocuments > 0 },
  { id: "copilot", title: "Ask the copilot what you missed", href: "/assistant?rescue=1", done: (f: ActivationFacts) => f.copilotRuns > 0 },
  { id: "plan", title: "Approve a recovery plan", href: "/recovery", done: (f: ActivationFacts) => f.approvedPlans > 0 },
  { id: "block", title: "Finish your first study block", href: "/planner", done: (f: ActivationFacts) => f.completedBlocks > 0 },
  { id: "check", title: "Take a knowledge check", href: "/quizzes", done: (f: ActivationFacts) => f.quizAttempts > 0 },
] as const;

export type ActivationStepId = (typeof ACTIVATION_STEPS)[number]["id"];

export function activationProgress(facts: ActivationFacts) {
  const steps = ACTIVATION_STEPS.map((s) => ({ id: s.id, title: s.title, href: s.href, done: s.done(facts) }));
  const done = steps.filter((s) => s.done).length;
  return {
    steps,
    done,
    total: steps.length,
    next: steps.find((s) => !s.done) ?? null,
    /** The activation milestone: an approved plan with at least one finished block. */
    activated: facts.approvedPlans > 0 && facts.completedBlocks > 0,
    complete: done === steps.length,
  };
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
