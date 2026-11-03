"use client";

import { Pause, Play, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";

type Block = { id: string; title: string; durationMinutes: number; startsAtLabel: string };
type Phase = "idle" | "running" | "paused" | "saving";

const PRESETS = [25, 50];

/** Wall-clock based timer (accurate in background tabs). Saves one session record when it ends. */
export default function FocusTimer({ blocks }: { blocks: Block[] }) {
  const router = useRouter();
  const [taskId, setTaskId] = useState<string>(blocks[0]?.id ?? "");
  const [minutes, setMinutes] = useState(25);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [markDone, setMarkDone] = useState(true);
  const [message, setMessage] = useState<{ tone: "info" | "danger"; text: string } | null>(null);
  const startedAt = useRef<number | null>(null);
  const runningSince = useRef<number | null>(null);
  const banked = useRef(0);

  const totalMs = minutes * 60_000;
  const remaining = Math.max(0, totalMs - elapsedMs);
  const mm = String(Math.floor(remaining / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60_000) / 1000)).padStart(2, "0");
  const block = blocks.find((b) => b.id === taskId);

  useEffect(() => {
    if (phase !== "running") return;
    const tick = setInterval(() => {
      const elapsed = banked.current + (Date.now() - (runningSince.current ?? Date.now()));
      setElapsedMs(elapsed);
    }, 250);
    return () => clearInterval(tick);
  }, [phase]);

  useEffect(() => {
    if (phase === "running" && elapsedMs >= totalMs) void finish(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedMs]);

  function start() {
    setMessage(null);
    if (startedAt.current === null) startedAt.current = Date.now();
    runningSince.current = Date.now();
    setPhase("running");
  }

  function pause() {
    banked.current += Date.now() - (runningSince.current ?? Date.now());
    runningSince.current = null;
    setPhase("paused");
  }

  async function finish(completed: boolean) {
    if (startedAt.current === null) return;
    const focused = phase === "running" ? banked.current + (Date.now() - (runningSince.current ?? Date.now())) : banked.current;
    setPhase("saving");
    try {
      await api("/api/focus-sessions", {
        method: "POST",
        body: {
          taskId: taskId || null,
          plannedMinutes: minutes,
          focusedMinutes: Math.min(minutes, Math.floor(focused / 60_000)),
          startedAt: new Date(startedAt.current).toISOString(),
          completed,
          markTaskDone: completed && markDone && Boolean(taskId),
        },
      });
      setMessage({ tone: "info", text: completed ? "Session complete and saved." : `Saved ${Math.floor(focused / 60_000)} focused minute(s).` });
      router.refresh();
    } catch (e) {
      setMessage({ tone: "danger", text: e instanceof ClientApiError ? e.message : "Couldn't save the session." });
    } finally {
      startedAt.current = null;
      runningSince.current = null;
      banked.current = 0;
      setElapsedMs(0);
      setPhase("idle");
    }
  }

  const active = phase === "running" || phase === "paused";
  return (
    <div className="glass focus-card">
      <div className="focus-time" role="timer" aria-live="off" aria-label={`${Math.ceil(remaining / 60_000)} minutes remaining`}>{mm}:{ss}</div>
      <div className="focus-sub">{phase === "running" ? "Deep focus" : phase === "paused" ? "Paused" : "Ready when you are"}</div>
      <p className="visually-hidden" aria-live="polite">{phase === "running" ? `Focus session started for ${minutes} minutes.` : phase === "paused" ? "Paused." : ""}</p>
      {!active ? (
        <div className="focus-setup">
          <div className="segmented" role="group" aria-label="Session length">
            {PRESETS.map((p) => <button key={p} type="button" aria-pressed={minutes === p} onClick={() => setMinutes(p)}>{p} min</button>)}
          </div>
          <div className="field" style={{ width: "100%" }}>
            <label htmlFor="focus-block">Study block</label>
            <select id="focus-block" className="select" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">No specific block</option>
              {blocks.map((b) => <option key={b.id} value={b.id}>{b.startsAtLabel} · {b.title}</option>)}
            </select>
          </div>
          {taskId ? (
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
              <input type="checkbox" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} /> Mark this block done when the session completes
            </label>
          ) : null}
        </div>
      ) : (
        <p className="focus-task">{block ? block.title : "Free focus session"}</p>
      )}
      <div className="focus-controls">
        {phase === "running" ? (
          <button type="button" className="btn primary" onClick={pause}><Pause className="ic" aria-hidden="true" /> Pause</button>
        ) : (
          <button type="button" className="btn primary" onClick={start} disabled={phase === "saving"}><Play className="ic" aria-hidden="true" /> {phase === "paused" ? "Resume" : "Start focus"}</button>
        )}
        {active ? <button type="button" className="btn" onClick={() => finish(false)}><Square className="ic" aria-hidden="true" /> End and save</button> : null}
      </div>
      {message ? <Notice tone={message.tone} title={message.text} /> : null}
    </div>
  );
}
