import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, type PolicySection } from "@/lib/legal/policy";

export const metadata: Metadata = { title: "Terms of use", description: "The plain-language terms for using CatchUp AI, a free student project." };

const sections: PolicySection[] = [
  {
    id: "service",
    title: "What CatchUp AI is",
    body: (
      <p>CatchUp AI is a free study-recovery tool built as a student project by Krishna Mathur for the Decoding Data Science Agentic AI Challenge (November 2026). It helps you plan around missed classes and answers questions from the notes you upload. There are no paid plans and no charges. By creating an account or trying the demo, you agree to these terms.</p>
    ),
  },
  {
    id: "ai",
    title: "AI answers can be wrong",
    body: (
      <>
        <p>Answers come from an AI model. Each cited fact is checked against the page it cites, and facts the check can&apos;t match are removed, but the check is not perfect. Suggestions are advice, not facts. Always confirm deadlines, exam rules and grades with your instructor or your course&apos;s official system.</p>
        <p>Study plans are drafts until you approve them. Nothing the copilot drafts changes your schedule without your approval.</p>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <ul>
        <li>You keep ownership of what you upload. You give CatchUp AI permission to store and process it only to run the app for you (see <Link href="/privacy">Privacy</Link>, including what the AI provider receives).</li>
        <li>Upload only material you are allowed to use for your own study, and nothing sensitive (health, financial or other people&apos;s personal data).</li>
        <li>You can export or delete your data at any time in Preferences.</li>
      </ul>
    ),
  },
  {
    id: "rules",
    title: "Fair use",
    body: (
      <ul>
        <li>Don&apos;t try to access other students&apos; data, break the security checks, or overload the service.</li>
        <li>Don&apos;t use CatchUp AI to cheat: it is a study aid, and your institution&apos;s academic integrity rules apply to how you use its output.</li>
        <li>AI use has daily limits (the free model tier and a token budget). When they are reached, the copilot pauses and everything else keeps working.</li>
      </ul>
    ),
  },
  {
    id: "availability",
    title: "Availability",
    body: (
      <p>The service is provided as is, without guarantees, and may change, pause or end after the challenge. The <Link href="/status">status page</Link> shows its live state. Demo accounts are deleted after 24 hours. If the project ends, accounts get notice where possible so you can export your data first.</p>
    ),
  },
  {
    id: "liability",
    title: "Responsibility",
    body: (
      <p>As far as the law allows, the developer isn&apos;t liable for missed deadlines, grades or other losses from relying on the app&apos;s answers or plans. Nothing in these terms limits rights you have under the consumer law where you live.</p>
    ),
  },
  {
    id: "ending",
    title: "Ending your use",
    body: <p>You can stop at any time and delete your account in Preferences. An account that breaks these terms (for example, by attacking the service) may be suspended.</p>,
  },
  {
    id: "changes",
    title: "Changes and questions",
    body: <p>If these terms change, the date at the top changes too, and earlier versions stay in the project&apos;s public Git history. Questions: use Send feedback in Preferences.</p>,
  },
];

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="Terms"
      title="Terms of use, in plain language"
      intro={<p>The short version: it&apos;s free, the AI can be wrong so check important details, your notes stay yours, and don&apos;t use it to cheat or to attack the service.</p>}
      sections={sections}
      other={{ href: "/privacy", label: "Privacy" }}
    />
  );
}
