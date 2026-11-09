"use client";

import { Printer } from "lucide-react";

/** Opens the browser's print dialog, where "Save as PDF" turns the page into a PDF. */
export default function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn small" onClick={() => window.print()}>
      <Printer className="ic" aria-hidden="true" /> {label}
    </button>
  );
}
