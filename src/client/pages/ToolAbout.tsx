import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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

  if (error) return <div style={{ color: "#dc2626" }}>Failed to load: {error}</div>;
  if (!payload) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  const { manifest, tools } = payload;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <header style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <span style={{ fontSize: 40 }}>{manifest.icon}</span>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>{manifest.displayName}</h2>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            claudepanion-{manifest.name} · v{manifest.version}
          </div>
          <p style={{ marginTop: 8, marginBottom: 0 }}>{manifest.description}</p>
        </div>
      </header>

      <section>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>MCP tools</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tools.map((t) => (
            <div key={t.name} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}>
              <code style={{ fontSize: 13, fontWeight: 600 }}>{t.signature}</code>
              {t.description && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{t.description}</div>}
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
    <section>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Try it</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
        <select value={selected} onChange={(e) => { setSelected(e.target.value); setArgsState({}); setResult(null); }} style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }}>
          {tools.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
        {tool.params.map((p) => (
          <label key={p.name} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            {p.name}{p.required ? " *" : ""}
            {p.type === "enum" ? (
              <select
                value={argsState[p.name] ?? ""}
                onChange={(e) => setArgsState((s) => ({ ...s, [p.name]: e.target.value }))}
                style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }}
              >
                <option value="">—</option>
                {(p.enum ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            ) : p.type === "boolean" ? (
              <select
                value={argsState[p.name] ?? ""}
                onChange={(e) => setArgsState((s) => ({ ...s, [p.name]: e.target.value }))}
                style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }}
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
                style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }}
              />
            )}
          </label>
        ))}
        <button className="btn" onClick={invoke} disabled={running} style={{ alignSelf: "flex-start" }}>
          {running ? "Invoking…" : "Invoke"}
        </button>
        {result && (
          <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 8, overflow: "auto", fontSize: 12 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </section>
  );
}
