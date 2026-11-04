/**
 * Incident notes for the public status page. Only real, documented incidents (see BUILD_STATUS.md), newest
 * first. Add an entry when something students can notice goes wrong, and update it when it's resolved.
 */
export type Incident = { date: string; title: string; impact: string; cause: string; fix: string; status: "Resolved" | "Monitoring" | "Investigating" };

export const INCIDENTS: Incident[] = [
  {
    date: "2026-11-04",
    title: "Copilot stuck on “Working…”",
    impact: "Copilot requests with more than one step failed on the live Gemini model. No student data was changed.",
    cause: "Gemini 3 returns a signature with each tool call and rejects the next step without it; the agent library dropped it.",
    fix: "The signature is now kept across tool calls, thinking is set to minimal, and quota errors fail fast with a clear message.",
    status: "Resolved",
  },
  {
    date: "2026-11-04",
    title: "Slow page loads",
    impact: "Pages took 0.6–2.0 s on the server and the dashboard about 5 s to load fully.",
    cause: "The app's server functions ran in Washington while the database is in Seoul, so every query crossed the Pacific.",
    fix: "Functions moved to Seoul (icn1), next to the database. The dashboard now loads in about 0.6 s.",
    status: "Resolved",
  },
];
