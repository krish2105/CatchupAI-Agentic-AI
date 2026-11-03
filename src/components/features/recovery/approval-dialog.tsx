"use client";

import { Check, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/controls";
import { Chip, Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import type { ProposalDto } from "@/lib/planner/service";
import { formatDateTime, formatMinutes } from "@/lib/time";

/** The human approval gate. One idempotency key per dialog, so double clicks/retries apply once. */
export default function ApprovalDialog({
  proposal,
  timezone,
  courseNames,
  currentPlan = null,
  onClose,
}: {
  proposal: ProposalDto | null;
  timezone: string;
  courseNames: Record<string, string>;
  currentPlan?: { todo: number; todoMinutes: number; completed: number } | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID().replaceAll("-", ""));

  if (!proposal) return null;
  const { summary, tasks, items } = proposal.payload;

  async function approve() {
    setBusy("approve");
    setError(null);
    try {
      await api(`/api/proposals/${proposal!.id}/approve`, { method: "POST", headers: { "idempotency-key": idempotencyKey } });
      router.push("/planner?approved=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Approval failed. Nothing was saved.");
      setBusy(null);
    }
  }

  async function reject() {
    setBusy("reject");
    setError(null);
    try {
      await api(`/api/proposals/${proposal!.id}/reject`, { method: "POST" });
      onClose();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't reject the proposal.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open onClose={onClose} labelledBy="approval-title">
      <div className="eyebrow">Human approval gate</div>
      <h2 id="approval-title" style={{ marginTop: 13 }}>Approve “{proposal.payload.title.split(" · ")[0]}”?</h2>
      <p>Times shown in {timezone}. Nothing is saved until you approve.</p>
      <div className="change-list" aria-label="Exact changes before approval">
        <div className="label">Exact changes before approval</div>
        <ul>
          <li className="add">Adds {tasks.length} study block{tasks.length === 1 ? "" : "s"} ({formatMinutes(summary.scheduledMinutes)}) across {new Set(tasks.map((t) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(t.startsAt)))).size} day(s)</li>
          {currentPlan && currentPlan.todo > 0 ? (
            <li className="remove">Cancels {currentPlan.todo} unfinished block{currentPlan.todo === 1 ? "" : "s"} ({formatMinutes(currentPlan.todoMinutes)}) from your current plan</li>
          ) : (
            <li className="keep">No current plan to replace</li>
          )}
          {currentPlan && currentPlan.completed > 0 ? <li className="keep">Keeps {currentPlan.completed} completed block{currentPlan.completed === 1 ? "" : "s"} in your history</li> : null}
          <li className="keep">Leaves your courses, assignments and documents unchanged</li>
        </ul>
      </div>
      {!proposal.feasible ? <Notice tone="danger" title="This route doesn't fit your time and can't be approved." /> : null}
      <ol style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 280, overflow: "auto" }} aria-label="Proposed tasks">
        {tasks.map((t) => (
          <li key={`${t.itemId}-${t.startsAt}`} className="task-item">
            <span style={{ minWidth: 0 }}>
              <Check className="ic" aria-hidden="true" />
              <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
                <span style={{ overflowWrap: "anywhere" }}>{t.title}</span>
                <span className="muted" style={{ fontSize: 10 }}>{courseNames[t.courseId] ?? "Course"} · {formatDateTime(t.startsAt, timezone)}</span>
              </span>
            </span>
            <b>{t.minutes} min</b>
          </li>
        ))}
      </ol>
      {items.some((i) => i.status !== "scheduled") ? (
        <p className="field-hint" style={{ marginTop: 10 }}>Some items don&apos;t fit before their deadlines; see the lab for details.</p>
      ) : null}
      {error ? <div style={{ marginTop: 12 }}><Notice tone="danger" title={error} /></div> : null}
      <div className="modal-actions" style={{ flexWrap: "wrap" }}>
        <Chip>Expires {formatDateTime(proposal.expiresAt, timezone, { weekday: undefined })}</Chip>
        <button type="button" className="btn ghost" onClick={reject} disabled={busy !== null}>
          {busy === "reject" ? <span className="spinner" aria-hidden="true" /> : null} Reject
        </button>
        <button type="button" className="btn primary" onClick={approve} disabled={busy !== null || !proposal.feasible}>
          {busy === "approve" ? <span className="spinner" aria-hidden="true" /> : <ShieldCheck className="ic" aria-hidden="true" />} Approve plan
        </button>
      </div>
    </Dialog>
  );
}
