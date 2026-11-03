import type { Metadata } from "next";
import { FlaskConical, ShieldCheck, Sparkles } from "lucide-react";
import PageHeading from "@/components/ui/page-heading";
import { ButtonLink, EmptyCard } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Recovery lab" };

export default function RecoveryPage() {
  return (
    <>
      <PageHeading
        eyebrow="Recovery intelligence engine"
        title="There is more than"
        accent="one way forward."
        description="Three recovery routes — essential, balanced and full — calculated deterministically from your deadlines, estimates and availability. Infeasible routes are flagged and cannot be approved."
        actions={<ButtonLink href="/assistant" small><Sparkles className="ic" aria-hidden="true" /> Ask copilot</ButtonLink>}
      />
      <EmptyCard icon={FlaskConical} title="Nothing to plan yet" action={<ButtonLink href="/courses" variant="primary" small>Add a course and assignments</ButtonLink>}>
        The lab needs at least one upcoming assignment and your weekly study availability before it can compare routes.
      </EmptyCard>
      <div className="lab-footer">
        <div className="card card-inner">
          <div className="split-head"><h3>Our promise</h3><ShieldCheck className="ic" aria-hidden="true" style={{ color: "var(--accent)" }} /></div>
          <p style={{ fontSize: 12, lineHeight: 1.85, color: "var(--muted)" }}>
            Your AI may recommend actions, but it cannot silently save or alter your plan. You inspect every proposed task and decide what happens next.
          </p>
          <div className="mini-activity" style={{ marginTop: 15 }}><div className="activity-dot" /><div><strong>Understand capacity</strong><p>Required work is compared to real availability.</p></div></div>
          <div className="mini-activity"><div className="activity-dot rose" /><div><strong>Never hide shortfalls</strong><p>Unrealistic plans are flagged before approval.</p></div></div>
        </div>
      </div>
    </>
  );
}
