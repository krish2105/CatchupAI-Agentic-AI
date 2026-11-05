import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, type PolicySection } from "@/lib/legal/policy";

export const metadata: Metadata = { title: "Privacy", description: "What CatchUp AI stores about you, who processes it, how long it is kept and how to export or delete it." };

const sections: PolicySection[] = [
  {
    id: "who",
    title: "Who runs CatchUp AI",
    body: (
      <>
        <p>CatchUp AI is a student project by Krishna Mathur, built for the Decoding Data Science Agentic AI Challenge (November 2026). It is not a company product. Students never pay; organisations can choose an optional paid plan (handled by Stripe). For any privacy question or request, use <strong>Send feedback</strong> in Preferences: only the operator reads it.</p>
        <p>This page is a plain-language summary written by the developer. It has not been reviewed by a lawyer.</p>
      </>
    ),
  },
  {
    id: "what",
    title: "What we store",
    body: (
      <ul>
        <li><strong>Account:</strong> your email address (for sign-in codes), display name, time zone and study preferences.</li>
        <li><strong>Your study data:</strong> courses, deadlines, uploaded PDF notes and the text extracted from them, plans you approve, focus sessions, quiz and teach-back attempts, weekly reflections and the memories you choose to keep.</li>
        <li><strong>Copilot runs:</strong> your question, the tools the copilot used, its answer and the pages it cited, and token counts. You can open each run in its trace view.</li>
        <li><strong>Organisations (optional):</strong> the schools or classes you join, your role, and whether you share class totals. Teachers and admins of that organisation see your display name, your role and whether you share; nothing else. If you share, your completed study minutes, open deadlines and latest check score are added to class totals, which are shown only when at least 3 students share.</li>
        <li><strong>Error reports:</strong> grouped error messages with emails, ids, numbers and secrets removed before they are stored.</li>
        <li><strong>Organisation invites</strong>: a one-way hash of the invited email address, a masked hint (such as j•••@example.com) for the admin&apos;s list, the role and the dates. The full address is never stored; invite links expire after 7 days.</li>
          </ul>
    ),
  },
  {
    id: "not",
    title: "What we don't do",
    body: (
      <ul>
        <li>No advertising, no selling or sharing of data for marketing, no tracking cookies and no analytics scripts. The app&apos;s only cookies are the sign-in session cookies, set when you sign in; your theme and motion settings stay in your browser&apos;s local storage.</li>
        <li>Other students can&apos;t see your data: every table is protected by row-level security, and this is tested on every release. Joining an organisation doesn&apos;t change that: teachers can&apos;t open your courses, notes, answers or plans.</li>
        <li>The copilot can&apos;t change your plan on its own. It drafts; you approve.</li>
      </ul>
    ),
  },
  {
    id: "processors",
    title: "Who processes it, and where",
    body: (
      <>
        <ul>
          <li><strong>Supabase</strong> (database, sign-in, file storage) and <strong>Vercel</strong> (hosting): servers in Seoul, South Korea.</li>
          <li><strong>Google Gemini API</strong> (the AI model and the search embeddings): your question and the passages from your notes that the copilot retrieves are sent to Google to produce an answer. Uploaded notes are also sent in pieces to create search embeddings, and a scanned PDF without selectable text is sent whole so the model can read its text. This project uses Gemini&apos;s free tier; under Google&apos;s terms for unpaid use, Google may use that content to improve its products, and people may review it. <strong>Don&apos;t upload anything sensitive</strong>, such as health or financial details.</li>
          <li><strong>Email delivery</strong> (Gmail SMTP): sign-in codes and, only if you turn them on, study reminder emails.</li>
          <li><strong>Cloudflare Turnstile</strong>: the bot check on the sign-in and demo buttons.</li>
          <li><strong>Stripe</strong> (only for organisations on a paid plan): the admin&apos;s email, the organisation&apos;s id and the payment details they enter at checkout. Card numbers stay with Stripe; CatchUp AI stores only the Stripe customer and subscription ids, the plan and the seat limit.</li>
        </ul>
        <p>Because these services run outside the UAE and the EU, your data is transferred abroad when you use the app.</p>
      </>
    ),
  },
  {
    id: "why",
    title: "Why we use it",
    body: (
      <p>Only to provide the service you asked for: sign-in, storing your study material, planning, answering your questions with citations, and the reminders you opted into. The legal basis is performing the service you signed up for (GDPR article 6(1)(b); UAE PDPL, processing needed to perform a contract) and, for optional reminder emails, your consent, which you can withdraw in Preferences at any time.</p>
    ),
  },
  {
    id: "keep",
    title: "How long we keep it",
    body: (
      <ul>
        <li>Your account and study data: until you delete them or your account.</li>
        <li>Deleting a document removes the file, its extracted text and its search index straight away. Earlier copilot answers keep their text and page references (not the file) until you delete your account.</li>
        <li>&ldquo;Try the demo&rdquo; accounts: deleted automatically after 24 hours.</li>
        <li>Database backups follow the hosting plan&apos;s backup retention, so deleted rows can remain in a backup until it ages out.</li>
      </ul>
    ),
  },
  {
    id: "rights",
    title: "Your rights and controls",
    body: (
      <>
        <p>You can access, correct, export and delete your data, and object to or restrict its use (GDPR articles 15–21; UAE PDPL articles 13–18). Most of this is self-service:</p>
        <ul>
          <li><strong>Export:</strong> <Link href="/settings">Preferences → Privacy and data → Export</Link> downloads everything stored about you as JSON.</li>
          <li><strong>Delete:</strong> <Link href="/settings">Preferences → Delete account</Link> removes your account, files and all records immediately.</li>
          <li><strong>Calendar feed:</strong> your private calendar link can be turned off or replaced in the study planner, which stops the old link working. Anyone with the link can read your deadlines and study blocks, so don&apos;t share it.</li>
          <li><strong>Memories:</strong> review, edit or delete what the copilot remembers in its memory panel.</li>
          <li><strong>Reminder emails:</strong> off unless you turn them on in Preferences.</li>
        </ul>
        <p>For anything else, use Send feedback. If you think your data was handled wrongly, you can also complain to your data protection authority (in the UAE, the UAE Data Office).</p>
      </>
    ),
  },
  {
    id: "age",
    title: "Age",
    body: <p>CatchUp AI is meant for university and college students. Don&apos;t use it if you are under 16.</p>,
  },
  {
    id: "changes",
    title: "Changes",
    body: <p>If this page changes, the date at the top changes too. Every earlier version is in the project&apos;s public Git history.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="Privacy"
      title="Privacy, in plain language"
      intro={<p>The short version: we store your study data only to run the app for you, other students can&apos;t see it, the AI sees only the passages it needs to answer you, and you can export or delete everything yourself at any time.</p>}
      sections={sections}
      other={{ href: "/terms", label: "Terms of use" }}
    />
  );
}
