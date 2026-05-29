import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Manifest } from "@shared/types";

interface ToolParam {
  name: string;
  type: "string" | "number" | "boolean" | "enum";
  required?: boolean;
  enum?: string[];
  description?: string;
}

interface ToolDescriptor {
  name: string;
  description: string;
  params: ToolParam[];
  signature: string;
}

interface AboutPayload {
  manifest: Manifest;
  tools: ToolDescriptor[];
}

export default function ToolAbout() {
  const { companion } = useParams<{ companion: string }>();
  const [payload, setPayload] = useState<AboutPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/tools/${companion}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (!cancelled) setPayload(data);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [companion]);

  if (error) return <div style={{ padding: 24, color: "var(--status-error)" }}>Failed to load: {error}</div>;
  if (!payload) return <div style={{ padding: 24, color: "var(--muted)" }}>Loading…</div>;

  const { manifest, tools } = payload;

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1100 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "flex-start",
          marginBottom: 24,
          paddingBottom: 20,
          borderBottom: "1px dashed color-mix(in srgb, var(--ink) 20%, transparent)",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            background: "var(--soft)",
            border: "var(--app-border)",
            display: "grid",
            placeItems: "center",
            fontSize: 22,
            flexShrink: 0,
          }}
          aria-hidden
        >
          {manifest.icon}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 className="wb-serif" style={{ fontSize: 38, lineHeight: 1.0, margin: "0 0 6px" }}>
            {manifest.displayName}
          </h1>
          <p className="wb-sans" style={{ margin: "0 0 8px", fontSize: 13, color: "var(--muted)", lineHeight: 1.55, maxWidth: 640 }}>
            {manifest.description}
          </p>
          <div style={{ display: "flex", gap: 14, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
            <span>claudepanion-{manifest.name}</span>
            <span>·</span>
            <span>v{manifest.version}</span>
            <span>·</span>
            <span>tool</span>
          </div>
        </div>
        <Link to={`/c/build/iterate/${manifest.name}`} className="wb-btn wb-btn-ghost wb-btn-sm" style={{ textDecoration: "none", flexShrink: 0 }}>
          🔨 iterate with build
        </Link>
      </div>

      {/* MCP tools list */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 10 }}>
          <span className="wb-section-label">mcp tools</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tools.map((t) => (
            <div key={t.name} className="wb-card" style={{ padding: "10px 14px" }}>
              <code style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{t.signature}</code>
              {t.description && (
                <div className="wb-sans" style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  {t.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <TryIt companion={companion!} tools={tools} />
    </div>
  );
}

function TryIt({ companion, tools }: { companion: string; tools: ToolDescriptor[] }) {
  const [selected, setSelected] = useState(tools[0]?.name ?? "");
  const [argsState, setArgsState] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ ok: boolean; result?: unknown; error?: string } | null>(null);
  const [running, setRunning] = useState(false);

  const tool = tools.find((t) => t.name === selected);
  if (!tool) return null;

  const invoke = async () => {
    setRunning(true);
    const args: Record<string, unknown> = {};
    for (const p of tool.params) {
      const raw = argsState[p.name] ?? "";
      if (raw === "" && !p.required) continue;
      if (p.type === "number") args[p.name] = Number(raw);
      else if (p.type === "boolean") args[p.name] = raw === "true";
      else args[p.name] = raw;
    }
    try {
      const r = await fetch(`/api/tools/${companion}/${selected}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ args }),
      });
      setResult(await r.json());
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="wb-card">
      <div className="wb-card-header wb-section-label">try it</div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
        <select
          value={selected}
          onChange={(e) => { setSelected(e.target.value); setArgsState({}); setResult(null); }}
          className="wb-input"
        >
          {tools.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
        {tool.params.map((p) => (
          <label key={p.name} style={{ display: "flex", flexDirection: "column", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
            // {p.name}{p.required ? " · required" : " · optional"}
            {p.type === "enum" ? (
              <select
                value={argsState[p.name] ?? ""}
                onChange={(e) => setArgsState((s) => ({ ...s, [p.name]: e.target.value }))}
                className="wb-input"
              >
                <option value="">—</option>
                {(p.enum ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            ) : p.type === "boolean" ? (
              <select
                value={argsState[p.name] ?? ""}
                onChange={(e) => setArgsState((s) => ({ ...s, [p.name]: e.target.value }))}
                className="wb-input"
              >
                <option value="">—</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                type={p.type === "number" ? "number" : "text"}
                value={argsState[p.name] ?? ""}
                onChange={(e) => setArgsState((s) => ({ ...s, [p.name]: e.target.value }))}
                className="wb-input"
              />
            )}
          </label>
        ))}
        <button onClick={invoke} disabled={running} className="wb-btn" style={{ alignSelf: "flex-start" }}>
          {running ? "invoking…" : "$ invoke"}
        </button>
        {result && (
          <pre className="wb-code" style={{ margin: 0, padding: 12, overflow: "auto", maxHeight: 320 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </section>
  );
}
