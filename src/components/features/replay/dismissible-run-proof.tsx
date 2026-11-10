"use client";

import { useSyncExternalStore } from "react";
import { X } from "lucide-react";

/** Remembers for this browser tab session that the visitor closed the home page's recorded-run card. */
const KEY = "catchup.runProofClosed";
const listeners = new Set<() => void>();
let closedInMemory = false;

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function isClosed() {
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function close() {
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    // Storage blocked (private mode): the card still closes for this page view.
  }
  closedInMemory = true;
  listeners.forEach((l) => l());
}

/** Wraps the recorded-run card with a close button; closing hides it and the hero falls back to one column. */
export default function DismissibleRunProof({ children }: { children: React.ReactNode }) {
  const closed = useSyncExternalStore(subscribe, () => closedInMemory || isClosed(), () => false);
  if (closed) return null;
  return (
    <div className="run-proof-wrap">
      {children}
      <button type="button" className="icon-btn run-proof-close" aria-label="Close the recorded run" title="Close" onClick={close}>
        <X className="ic" aria-hidden="true" />
      </button>
    </div>
  );
}
