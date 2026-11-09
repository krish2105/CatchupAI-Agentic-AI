/**
 * The "Built for UAE rules" panel on /quality: each control a student or judge can check, with the code that
 * implements it and the test that proves it. A unit test fails if a path stops existing, so the links can't rot.
 */
export type TrustControl = { title: string; what: string; code: string; test: string };

export const TRUST_CONTROLS: TrustControl[] = [
  {
    title: "Students aged 13 and over",
    what: "Onboarding asks for confirmation of age 13 or over (following UAE Ministry of Education guidance on generative AI). Under 13: a polite stop, and the sign-in is deleted at once, so nothing is kept.",
    code: "src/lib/account/under-age.ts",
    test: "tests/e2e/trust-panel.spec.ts",
  },
  {
    title: "Personal details removed before the AI sees them",
    what: "Email addresses, phone numbers and Emirates ID numbers are masked in every copilot message before it reaches the model or is stored.",
    code: "src/lib/privacy/scrub.ts",
    test: "tests/unit/trust-panel.test.ts",
  },
  {
    title: "AI-use disclosure for coursework",
    what: "Students can download a record of which answers and plans the AI drafted, the pages it cited and what they approved, to attach to their work.",
    code: "src/lib/disclosure/build.ts",
    test: "tests/integration/trust-panel.test.ts",
  },
  {
    title: "Nothing is saved without the student's approval",
    what: "The AI only drafts. A plan is saved by one locked, idempotent database transaction that the student triggers.",
    code: "supabase/migrations/20261103000003_proposal_approval.sql",
    test: "tests/integration/approval.test.ts",
  },
  {
    title: "Facts cite the student's own pages",
    what: "Every fact must be supported by a page retrieved from the student's notes; anything else is removed, or the copilot says it couldn't verify it.",
    code: "src/lib/rag/claim-support.ts",
    test: "tests/unit/claim-support.test.ts",
  },
  {
    title: "The copilot stays on studying",
    what: "Requests unrelated to the student's courses get one fixed redirect, enforced on the server, never the model's own text.",
    code: "src/lib/agents/scope.ts",
    test: "tests/unit/copilot-conversation.test.ts",
  },
  {
    title: "Religious settings are opt-in; no device location",
    what: "Friday prayer, prayer-time breaks and Ramadan settings are off until the student turns them on; prayer times come from a chosen city, never the device's location.",
    code: "src/lib/planner/calendar-options.ts",
    test: "tests/unit/local-calendar.test.ts",
  },
  {
    title: "Each student's data stays private",
    what: "Row-level security on every table and keys that tie every row to its owner; tested with two students on every release.",
    code: "supabase/migrations/20261103000001_core_schema.sql",
    test: "tests/integration/rls.test.ts",
  },
];
