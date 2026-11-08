"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import type { ProposalDto } from "@/lib/planner/service";
import { formatDateTime, formatMinutes } from "@/lib/time";
import ApprovalDialog from "./approval-dialog";
import SelfCheckBadge from "./self-check-badge";

/**
 * "CatchUp noticed something": the daily check-in's draft, with the reason it was made. Approval goes through the
 * same approval dialog as the Recovery lab (one idempotency key, the approve_proposal transaction); Dismiss rejects
 * the draft, so nothing is saved. A draft that doesn't fit can't be approved and points to the lab instead.
 */
export default function CheckinCard({
  proposal,
  reason,
  timezone,
  courseNames,
  currentPlan,
}: {
  proposal: ProposalDto;
  reason: string;
  timezone: string;
  courseNames: Record<string, string>;
  currentPlan: { todo: number; todoMinutes: number; completed: number } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { summary, tasks, title } = proposal.payload;
  const approvable = proposal.feasible && proposal.selfCheck.status !== "fail";
  const route = title.split(" · ")[0];
  const first = tasks[0]?.startsAt;

  async function dismiss() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/proposals/${proposal.id}/reject`, { method: "POST" });
      router.refresh();
    } catch (e) {
      // Already approved, rejected or expired elsewhere: the card is out of date either way.
      if (e instanceof ClientApiError && e.status === 409) router.refresh();
      else setError(e instanceof ClientApiError ? e.message : "Couldn't dismiss it. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card nf-replan checkin-card" aria-labelledby="checkin-head">
      <span className="nf-replan-icon" aria-hidden="true"><Sparkles className="ic" /></span>
      <div>
        <h2 id="checkin-head">CatchUp noticed something</h2>
        <p><strong className="checkin-reason">{reason}.</strong></p>
        <p>
          {approvable
            ? `It drafted a fix: the ${route.toLowerCase()} route, ${tasks.length} study block${tasks.length === 1 ? "" : "s"} (${formatMinutes(summary.scheduledMinutes)})${first ? ` from ${formatDateTime(first, timezone)}` : ""}.`
            : `Even the deadline-first route is ${formatMinutes(summary.shortfallMinutes)} short, so there's nothing to approve. A what-if in the Recovery lab shows how much more time would make it fit.`}{" "}
          Nothing changes until you approve.
        </p>
        <div className="checkin-check"><SelfCheckBadge check={proposal.selfCheck} timeFormat={(iso) => formatDateTime(iso, timezone)} /></div>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
      </div>
      <div className="checkin-actions">
        {approvable ? (
          <button type="button" className="btn primary" onClick={() => setOpen(true)} disabled={busy}>Review and approve</button>
        ) : (
          <ButtonLink href="/recovery?replan=1" variant="primary">Open the Recovery lab</ButtonLink>
        )}
        <button type="button" className="btn ghost" onClick={dismiss} disabled={busy}>Dismiss</button>
      </div>
      {open ? (
        <ApprovalDialog
          proposal={proposal}
          timezone={timezone}
          courseNames={courseNames}
          currentPlan={currentPlan}
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}
