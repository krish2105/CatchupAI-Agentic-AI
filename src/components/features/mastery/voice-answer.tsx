"use client";

import { Mic } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import type { Confidence } from "@/lib/mastery/elo";
import { parseVoiceAnswer } from "@/lib/mastery/voice";

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};
type RecognitionCtor = new () => Recognition;

const ctor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
const noSubscribe = () => () => {};

/** "Answer by voice": say "B", "the second one" or the option's words, and optionally "I'm sure" or "guessing". */
export default function VoiceAnswer({ options, onAnswer }: { options: string[]; onAnswer: (chosen: number, confidence: Confidence | null) => void }) {
  const supported = useSyncExternalStore(noSubscribe, () => Boolean(ctor()), () => false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  if (!supported) return null;

  function listen() {
    const Ctor = ctor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      const parsed = parseVoiceAnswer(transcript, options);
      setHeard(parsed.chosen === null ? `Heard "${transcript}". Try a letter, like "B, I'm sure".` : `Heard "${transcript}".`);
      if (parsed.chosen !== null) onAnswer(parsed.chosen, parsed.confidence);
    };
    recognition.onerror = () => setHeard("Couldn't hear that. Check the microphone and try again.");
    recognition.onend = () => setListening(false);
    setListening(true);
    setHeard(null);
    recognition.start();
  }

  return (
    <div className="voice-answer">
      <button type="button" className="btn ghost small" onClick={listen} disabled={listening}>
        <Mic className="ic" aria-hidden="true" /> {listening ? "Listening…" : "Answer by voice"}
      </button>
      {heard ? <span aria-live="polite">{heard}</span> : <span>Say a letter, and how sure you are.</span>}
    </div>
  );
}
