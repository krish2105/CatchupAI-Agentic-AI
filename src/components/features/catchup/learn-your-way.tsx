"use client";

import { BookOpenText, Headphones, Target } from "lucide-react";
import { useSyncExternalStore } from "react";

type Mode = "read" | "listen";
const KEY = "catchup.learnMode";
const listeners = new Set<() => void>();
let inMemory: Mode | null = null;

function read(): Mode {
  if (inMemory) return inMemory;
  try {
    return window.localStorage.getItem(KEY) === "listen" ? "listen" : "read";
  } catch {
    return "read";
  }
}

function choose(mode: Mode) {
  inMemory = mode;
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    // Storage blocked: the choice still applies on this page.
  }
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/**
 * Learn your way: read the cited pack, listen to it as a two-voice lesson, or practise with the agents. Students
 * choose and switch freely (remembered on this device); we personalise on what they know, not on a style label.
 */
export default function LearnYourWay({ read: readView, listen: listenView }: { read: React.ReactNode; listen: React.ReactNode }) {
  const mode = useSyncExternalStore(subscribe, read, () => "read" as Mode);
  const practise = () => {
    const panel = document.getElementById("mastery-head");
    panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    panel?.closest("section")?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  };
  return (
    <div className="learn-your-way">
      <div className="learn-modes" role="group" aria-label="Learn your way">
        <span className="label">Learn your way</span>
        <button type="button" aria-pressed={mode === "read"} className={`chip-toggle${mode === "read" ? " on" : ""}`} onClick={() => choose("read")}>
          <BookOpenText className="ic" aria-hidden="true" /> Read
        </button>
        <button type="button" aria-pressed={mode === "listen"} className={`chip-toggle${mode === "listen" ? " on" : ""}`} onClick={() => choose("listen")}>
          <Headphones className="ic" aria-hidden="true" /> Listen
        </button>
        <button type="button" className="chip-toggle" onClick={practise}>
          <Target className="ic" aria-hidden="true" /> Practise
        </button>
      </div>
      <div hidden={mode !== "read"}>{readView}</div>
      <div hidden={mode !== "listen"}>{listenView}</div>
    </div>
  );
}
