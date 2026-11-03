"use client";

import { Headphones } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Opt-in ambient sound: soft brown noise generated in the browser (no audio files, nothing autoplays).
 * Off by default and stopped when the page closes.
 */
export default function AmbientSound() {
  const [on, setOn] = useState(false);
  const ctx = useRef<AudioContext | null>(null);

  useEffect(() => () => void ctx.current?.close(), []);

  async function toggle() {
    if (on) {
      await ctx.current?.suspend();
      setOn(false);
      return;
    }
    if (!ctx.current) {
      const audio = new AudioContext();
      const seconds = 4;
      const buffer = audio.createBuffer(1, audio.sampleRate * seconds, audio.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        data[i] = last * 3.5;
      }
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = audio.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      const gain = audio.createGain();
      gain.gain.value = 0.18;
      source.connect(filter).connect(gain).connect(audio.destination);
      source.start();
      ctx.current = audio;
    } else {
      await ctx.current.resume();
    }
    setOn(true);
  }

  return (
    <button type="button" className="focus-pill" aria-pressed={on} onClick={toggle}>
      <Headphones className="ic" aria-hidden="true" /> Ambient sound: {on ? "on" : "off"}
    </button>
  );
}
