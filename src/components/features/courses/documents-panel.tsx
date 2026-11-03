"use client";

import { ExternalLink, FileText, RotateCcw, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Chip, Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";
import type { DocumentDto } from "@/lib/db/documents";
import { uploadAndProcessPdf } from "@/lib/client/upload";

function statusChip(doc: DocumentDto) {
  switch (doc.status) {
    case "ready":
      return <Chip tone="good">Indexed · {doc.pageCount} page{doc.pageCount === 1 ? "" : "s"}</Chip>;
    case "failed":
      return <Chip tone="danger">Failed</Chip>;
    case "processing":
      return <Chip tone="warn">Processing…</Chip>;
    default:
      return <Chip>Waiting for file</Chip>;
  }
}

export default function DocumentsPanel({ courseId, documents }: { courseId: string; documents: DocumentDto[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    try {
      await uploadAndProcessPdf(courseId, file, setProgress);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
      router.refresh();
    }
  }

  async function process(id: string) {
    setProgress("Extracting text and indexing pages…");
    try {
      await api(`/api/documents/${id}/process`, { method: "POST" });
    } catch (e) {
      // 422 = processed but rejected (e.g. scanned PDF); the reason shows on the document row.
      if (!(e instanceof ClientApiError && e.status === 422)) setError(e instanceof Error ? e.message : "Processing failed.");
    }
  }

  async function retry(id: string) {
    setError(null);
    await process(id);
    setProgress(null);
    router.refresh();
  }

  async function remove(doc: DocumentDto) {
    if (!window.confirm(`Remove “${doc.filename}” and its indexed passages?`)) return;
    try {
      await api(`/api/documents/${doc.id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't remove the document.");
    }
  }

  return (
    <div className="card card-inner" id="documents">
      <div className="split-head"><h3>Course documents</h3><Chip>{documents.filter((d) => d.status === "ready").length} indexed</Chip></div>
      {documents.length ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Documents">
          {documents.map((doc) => (
            <li key={doc.id} className="task-item" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
              <span style={{ minWidth: 0, flex: "1 1 200px" }}>
                <FileText className="ic" aria-hidden="true" />
                <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
                  <strong style={{ fontSize: 12.5, overflowWrap: "anywhere" }}>{doc.filename}</strong>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {(doc.sizeBytes / 1024).toFixed(0)} KB{doc.searchMode ? ` · ${doc.searchMode === "hybrid" ? "semantic + keyword search" : "keyword search"}` : ""}
                  </span>
                  {doc.errorMessage ? <span className="field-error">{doc.errorMessage}</span> : null}
                </span>
              </span>
              <span style={{ gap: 6 }}>
                {statusChip(doc)}
                {doc.status === "ready" ? (
                  <a className="icon-btn" href={`/api/documents/${doc.id}/source`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${doc.filename}`}>
                    <ExternalLink className="ic" aria-hidden="true" />
                  </a>
                ) : null}
                {doc.status === "failed" || doc.status === "uploaded" ? (
                  <button type="button" className="icon-btn" aria-label={`Retry processing ${doc.filename}`} onClick={() => retry(doc.id)} disabled={progress !== null}>
                    <RotateCcw className="ic" aria-hidden="true" />
                  </button>
                ) : null}
                <button type="button" className="icon-btn" aria-label={`Remove ${doc.filename}`} onClick={() => remove(doc)}><Trash2 className="ic" aria-hidden="true" /></button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div
        className="dropzone"
        style={dragging ? { borderColor: "var(--accent)" } : undefined}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
      >
        <UploadCloud className="ic" aria-hidden="true" />
        <strong>Drop a text-based PDF here, or choose one</strong>
        <p>Up to 10 MB and 50 pages. Stored privately; only you can search it.</p>
        <label className="btn small" htmlFor={`pdf-input-${courseId}`} aria-disabled={progress !== null}>Choose PDF</label>
        <input
          ref={input}
          id={`pdf-input-${courseId}`}
          type="file"
          accept="application/pdf,.pdf"
          className="visually-hidden"
          disabled={progress !== null}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <p role="status" aria-live="polite">{progress ? <><span className="spinner" aria-hidden="true" /> {progress}</> : null}</p>
      </div>
      {error ? <div style={{ marginTop: 12 }}><Notice tone="danger" title={error} /></div> : null}
    </div>
  );
}
