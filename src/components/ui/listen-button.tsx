"use client";

import { Pause, Play, Square, Volume2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;
const subscribe = () => () => {};

/**
 * Reads text aloud with the browser's own voices (no AI, no cost, works offline). Nothing plays until the
 * student presses Listen; leaving the page stops it.
 */
export default function ListenButton({ text, label = "Listen" }: { text: string; label?: string }) {
  const available = useSyncExternalStore(subscribe, supported, () => false);
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [rate, setRate] = useState(1);

  useEffect(() => () => {
    if (supported()) window.speechSynthesis.cancel();
  }, []);

  if (!available) return null;

  function play() {
    const synth = window.speechSynthesis;
    if (state === "paused") {
      synth.resume();
      setState("playing");
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.lang = "en-GB";
    utterance.onend = () => setState("idle");
    utterance.onerror = () => setState("idle");
    synth.speak(utterance);
    setState("playing");
  }

  return (
    <span className="listen" role="group" aria-label="Read aloud">
      {state === "playing" ? (
        <button type="button" className="btn small" onClick={() => { window.speechSynthesis.pause(); setState("paused"); }}><Pause className="ic" aria-hidden="true" /> Pause</button>
      ) : (
        <button type="button" className="btn small" onClick={play}>{state === "paused" ? <Play className="ic" aria-hidden="true" /> : <Volume2 className="ic" aria-hidden="true" />} {state === "paused" ? "Resume" : label}</button>
      )}
      {state !== "idle" ? (
        <button type="button" className="icon-btn" aria-label="Stop reading" onClick={() => { window.speechSynthesis.cancel(); setState("idle"); }}><Square className="ic" aria-hidden="true" /></button>
      ) : null}
      <label className="visually-hidden" htmlFor="listen-rate">Reading speed</label>
      <select id="listen-rate" className="select listen-rate" value={rate} onChange={(e) => setRate(Number(e.target.value))} disabled={state !== "idle"}>
        <option value={0.85}>0.85×</option>
        <option value={1}>1×</option>
        <option value={1.25}>1.25×</option>
      </select>
    </span>
  );
}
