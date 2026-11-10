"use client";

import { Headphones, Pause, Play, Square } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LessonLine } from "@/lib/catchup/lesson";

const noSubscribe = () => () => {};
const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Two different English voices when the device has them; otherwise one voice with a different pitch. */
function pickVoices(): [SpeechSynthesisVoice | undefined, SpeechSynthesisVoice | undefined] {
  const english = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const host = english[0];
  return [host, english.find((v) => v.name !== host?.name) ?? host];
}

/**
 * Listen mode: a host asks, a tutor answers with sentences from the student's own lecture, read aloud by the
 * browser (free, on the device). The transcript shows each line with its page, so it works without sound too.
 */
export default function ListenLesson({ lines, documentId }: { lines: LessonLine[]; documentId: string }) {
  const speakable = useSyncExternalStore(noSubscribe, canSpeak, () => false);
  const [current, setCurrent] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [rate, setRate] = useState(1);
  const stopped = useRef(false);

  useEffect(() => () => {
    if (canSpeak()) window.speechSynthesis.cancel();
  }, []);

  function speakFrom(index: number) {
    if (index >= lines.length || stopped.current) {
      setState("idle");
      setCurrent(null);
      return;
    }
    const [host, tutor] = pickVoices();
    const line = lines[index];
    const utterance = new SpeechSynthesisUtterance(line.text);
    const voice = line.speaker === "host" ? host : tutor;
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    utterance.pitch = line.speaker === "host" ? 1.1 : 0.9;
    utterance.onend = () => speakFrom(index + 1);
    setCurrent(index);
    window.speechSynthesis.speak(utterance);
  }

  function play() {
    if (state === "paused") {
      window.speechSynthesis.resume();
      setState("playing");
      return;
    }
    stopped.current = false;
    window.speechSynthesis.cancel();
    setState("playing");
    speakFrom(current ?? 0);
  }

  function pause() {
    window.speechSynthesis.pause();
    setState("paused");
  }

  function stop() {
    stopped.current = true;
    window.speechSynthesis.cancel();
    setState("idle");
    setCurrent(null);
  }

  return (
    <section className="card listen-lesson" aria-labelledby="listen-head">
      <div className="split-head">
        <h3 id="listen-head"><Headphones className="ic" aria-hidden="true" /> Listen: a two-voice lesson</h3>
        {speakable ? (
          <div className="listen-controls">
            {state === "playing" ? (
              <button type="button" className="btn small primary" onClick={pause}><Pause className="ic" aria-hidden="true" /> Pause</button>
            ) : (
              <button type="button" className="btn small primary" onClick={play}><Play className="ic" aria-hidden="true" /> {state === "paused" ? "Resume" : "Play the lesson"}</button>
            )}
            <button type="button" className="btn small ghost" onClick={stop} disabled={state === "idle"}><Square className="ic" aria-hidden="true" /> Stop</button>
            <label className="listen-rate">
              Speed
              <select value={rate} onChange={(e) => setRate(Number(e.target.value))} disabled={state !== "idle"}>
                <option value={0.85}>Slower</option>
                <option value={1}>Normal</option>
                <option value={1.2}>Faster</option>
              </select>
            </label>
          </div>
        ) : null}
      </div>
      <p className="muted small">
        A host asks, a tutor answers only with sentences from your notes, each with its page. Read aloud on your device; nothing is sent anywhere.
        {speakable ? "" : " This browser can't read aloud, so here is the transcript."}
      </p>
      <ol className="lesson-lines" aria-label="Lesson transcript">
        {lines.map((line, i) => (
          <li key={i} className={`lesson-line ${line.speaker}${i === current ? " current" : ""}`} aria-current={i === current ? "true" : undefined}>
            <span className="lesson-speaker">{line.speaker === "host" ? "Host" : "Tutor"}</span>
            <span>
              {line.text}
              {line.page ? (
                <>
                  {" "}
                  <a className="cite-chip" href={`/api/documents/${documentId}/source?page=${line.page}`} target="_blank" rel="noopener noreferrer">p. {line.page}</a>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
