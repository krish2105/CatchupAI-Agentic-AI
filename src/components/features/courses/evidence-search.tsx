"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Chip, Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";

type Result = {
  abstained: boolean;
  mode: "hybrid" | "lexical";
  citations: { chunkId: string; documentId: string; filename: string; pageStart: number; pageEnd: number; snippet: string }[];
};

/** Searches the course's own documents and shows verbatim passages with page references. */
export default function EvidenceSearch({ courseId, enabled }: { courseId: string; enabled: boolean }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(await api<Result>(`/api/courses/${courseId}/search?q=${encodeURIComponent(query)}`));
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-inner section-space">
      <div className="split-head"><h3>Search your evidence</h3>{result ? <Chip>{result.mode === "hybrid" ? "Semantic + keyword" : "Keyword"} search</Chip> : null}</div>
      {!enabled ? (
        <p className="muted" style={{ fontSize: 12 }}>Upload and index a PDF to search it.</p>
      ) : (
        <form onSubmit={search} className="chat-compose" style={{ margin: 0 }} role="search">
          <label className="visually-hidden" htmlFor="evidence-q">Search this course&apos;s documents</label>
          <input id="evidence-q" placeholder="e.g. What is a residual?" value={query} onChange={(e) => setQuery(e.target.value)} minLength={2} maxLength={500} required />
          <button type="submit" aria-label="Search" disabled={busy}>{busy ? <span className="spinner" aria-hidden="true" /> : <Search className="ic" aria-hidden="true" />}</button>
        </form>
      )}
      {error ? <div style={{ marginTop: 12 }}><Notice tone="danger" title={error} /></div> : null}
      {result ? (
        <div style={{ marginTop: 16 }} aria-live="polite">
          {result.abstained ? (
            <Notice tone="info" title="I couldn't verify that in your uploaded materials.">Try different words, or upload the material that covers this topic.</Notice>
          ) : (
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }} aria-label="Matching passages">
              {result.citations.map((c) => (
                <li key={c.chunkId} className="notice info" style={{ display: "block" }}>
                  <a href={`/api/documents/${c.documentId}/source?page=${c.pageStart}`} target="_blank" rel="noopener noreferrer" className="text-link" style={{ display: "inline-flex", padding: 0 }}>
                    {c.filename} · p. {c.pageStart}{c.pageEnd !== c.pageStart ? `–${c.pageEnd}` : ""}
                  </a>
                  <blockquote style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.7, color: "var(--text)" }}>{c.snippet}</blockquote>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </div>
  );
}
