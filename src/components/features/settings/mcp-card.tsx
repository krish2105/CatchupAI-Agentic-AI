"use client";

import { Copy, KeyRound, Trash2 } from "lucide-react";
import { useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { api, ClientApiError } from "@/lib/client/api";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Personal access token for MCP apps (read-only). The token is shown once; only its hash is stored. */
export default function McpCard({ status, isAnonymous, origin }: { status: { createdAt: string; lastUsedAt: string | null } | null; isAnonymous: boolean; origin: string }) {
  const [current, setCurrent] = useState(status);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `${origin}/api/mcp`;
  const config = token ? JSON.stringify({ mcpServers: { "catchup-ai": { command: "npx", args: ["-y", "mcp-remote", url, "--header", `Authorization: Bearer ${token}`] } } }, null, 2) : "";

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string }>("/api/mcp/token", { method: "POST" });
      setToken(res.token);
      setCurrent({ createdAt: new Date().toISOString(), lastUsedAt: null });
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't create a token.");
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/mcp/token", { method: "DELETE" });
      setToken(null);
      setCurrent(null);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't revoke the token.");
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    await navigator.clipboard.writeText(config).then(() => setCopied(true), () => setCopied(false));
  }

  return (
    <div className="card setting-card">
      <div className="split-head"><h3>Use CatchUp in other AI apps</h3></div>
      <p className="muted setting-foot" style={{ marginTop: 0 }}>
        A personal token lets MCP apps (Cursor, VS Code, or any client via mcp-remote) read your deadlines, plan, notes and catch-up packs.
        Read-only: plans can only be changed and approved here. ChatGPT connectors need OAuth, which isn&apos;t available yet.
      </p>
      <div className="setting-line">
        <div>
          <strong>Personal MCP token</strong>
          <p>{current ? `Created ${when(current.createdAt)} · ${current.lastUsedAt ? `last used ${when(current.lastUsedAt)}` : "not used yet"}` : "No token. Nothing outside this app can read your data."}</p>
        </div>
        <span className="memory-actions">
          <button type="button" className="btn small" onClick={create} disabled={busy || isAnonymous}><KeyRound className="ic" aria-hidden="true" /> {current ? "Replace token" : "Create token"}</button>
          {current ? <button type="button" className="btn small ghost" onClick={revoke} disabled={busy}><Trash2 className="ic" aria-hidden="true" /> Revoke</button> : null}
        </span>
      </div>
      {isAnonymous ? <p className="muted setting-foot">Demo accounts can&apos;t connect other apps.</p> : null}
      {token ? (
        <div className="mcp-token">
          <Notice tone="info" title="Copy this now. It won't be shown again.">Anyone with this token can read your study data. Revoke it here if it leaks.</Notice>
          <label className="label" htmlFor="mcp-config">MCP config (server URL {url})</label>
          <textarea id="mcp-config" className="input mcp-config" readOnly rows={9} value={config} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn small" onClick={copy}><Copy className="ic" aria-hidden="true" /> {copied ? "Copied" : "Copy config"}</button>
        </div>
      ) : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
