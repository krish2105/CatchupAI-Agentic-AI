"use client";

import { Leaf, Pause, Play, RotateCcw, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";

type Block = { id: string; title: string; durationMinutes: number; startsAtLabel: string };
type Phase = "idle" | "running" | "paused" | "saving";

const PRESETS = [25, 50];
const STORE = "catchup:focus-session";
/** A session left alone longer than this is not resumed (it would no longer reflect real focus). */
const RESUME_LIMIT_MS = 6 * 3600_000;

type Saved = { minutes: number; taskId: string; markDone: boolean; startedAt: number; runningSince: number | null; banked: number };

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORE);
    const s = raw ? (JSON.parse(raw) as Saved) : null;
    return s && typeof s.startedAt === "number" && Date.now() - s.startedAt < RESUME_LIMIT_MS ? s : null;
  } catch {
    return null;
  }
}
function writeSaved(s: Saved | null) {
  try {
    if (s) localStorage.setItem(STORE, JSON.stringify(s));
    else localStorage.removeItem(STORE);
  } catch {
    // Storage can be unavailable (private mode); the timer still works for this page view.
  }
}

/**
 * Wall-clock based timer (accurate in background tabs). The in-progress session is kept in this browser,
 * so a refresh or dropped connection resumes it; one session record is saved to the server when it ends.
 */
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

  // Resume a session that was running before a refresh or interruption.
  useEffect(() => {
    const saved = readSaved();
    if (!saved) return;
    const timer = setTimeout(() => {
      startedAt.current = saved.startedAt;
      runningSince.current = saved.runningSince;
      banked.current = saved.banked;
      setMinutes(saved.minutes);
      setTaskId(saved.taskId);
      setMarkDone(saved.markDone);
      setElapsedMs(saved.banked + (saved.runningSince ? Date.now() - saved.runningSince : 0));
      setPhase(saved.runningSince ? "running" : "paused");
      setMessage({ tone: "info", text: "Resumed your session from where you left off." });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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

  function persist() {
    if (startedAt.current === null) return writeSaved(null);
    writeSaved({ minutes, taskId, markDone, startedAt: startedAt.current, runningSince: runningSince.current, banked: banked.current });
  }

  function start() {
    setMessage(null);
    if (startedAt.current === null) startedAt.current = Date.now();
    runningSince.current = Date.now();
    persist();
    setPhase("running");
  }

  function pause() {
    banked.current += Date.now() - (runningSince.current ?? Date.now());
    runningSince.current = null;
    persist();
    setPhase("paused");
  }

  function reset() {
    startedAt.current = null;
    runningSince.current = null;
    banked.current = 0;
    writeSaved(null);
    setElapsedMs(0);
    setPhase("idle");
    setMessage({ tone: "info", text: "Timer reset. Nothing was saved." });
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
      writeSaved(null);
      setMessage({ tone: "info", text: completed ? "Session complete and saved." : `Saved ${Math.floor(focused / 60_000)} focused minute(s).` });
      startedAt.current = null;
      runningSince.current = null;
      banked.current = 0;
      setElapsedMs(0);
      setPhase("idle");
      router.refresh();
    } catch (e) {
      // Keep the session (and its local copy) so the student can retry saving.
      setMessage({ tone: "danger", text: e instanceof ClientApiError ? e.message : "Couldn't save the session. Your time is kept; try again." });
      setPhase("paused");
      if (runningSince.current !== null) {
        banked.current += Date.now() - runningSince.current;
        runningSince.current = null;
      }
      persist();
    }
  }

  const active = phase === "running" || phase === "paused";
  return (
    <div className="glass focus-card">
      <span className="focus-leaf" aria-hidden="true"><Leaf className="ic" /></span>
      <div className="focus-sub">A moment to make progress</div>
      <div className="focus-dial">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="54" className="dial-track" />
          <circle cx="60" cy="60" r="54" className="dial-fill" pathLength={100} strokeDasharray={`${(remaining / totalMs) * 100} 100`} />
        </svg>
        <div className="focus-time" role="timer" aria-live="off" aria-label={`${Math.ceil(remaining / 60_000)} minutes remaining`}>{mm}:{ss}</div>
        <div className="focus-mode">{phase === "running" ? "Deep focus" : phase === "paused" ? "Paused" : "Ready when you are"}</div>
      </div>
      <p className="visually-hidden" aria-live="polite">{phase === "running" ? `Focus session running, ${minutes} minutes.` : phase === "paused" ? "Paused." : ""}</p>
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
            <label className="focus-check">
              <input type="checkbox" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} /> Mark this block done when the session completes
            </label>
          ) : null}
        </div>
      ) : (
        <p className="focus-task">{block ? `${block.title} · ${block.startsAtLabel}` : "Free focus session"}</p>
      )}
      <div className="focus-controls" role="group" aria-label="Timer controls">
        <button type="button" className="focus-round" onClick={reset} disabled={!active} aria-label="Reset timer without saving" title="Reset">
          <RotateCcw className="ic" aria-hidden="true" />
        </button>
        {phase === "running" ? (
          <button type="button" className="focus-round play" onClick={pause} aria-label="Pause"><Pause className="ic" aria-hidden="true" /></button>
        ) : (
          <button type="button" className="focus-round play" onClick={start} disabled={phase === "saving"} aria-label={phase === "paused" ? "Resume" : "Start focus"}>
            {phase === "saving" ? <span className="spinner" aria-hidden="true" /> : <Play className="ic" aria-hidden="true" />}
          </button>
        )}
        <button type="button" className="focus-round" onClick={() => finish(false)} disabled={!active} aria-label="End and save" title="End and save">
          <Square className="ic" aria-hidden="true" />
        </button>
      </div>
      {message ? <Notice tone={message.tone} title={message.text} /> : null}
    </div>
  );
}
