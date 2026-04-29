import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { BuildInput } from "./types";
import { buildExamples } from "./examples";
import { useCompanions } from "../../src/client/hooks/useCompanions";

interface Props {
  onSubmit: (input: BuildInput) => void | Promise<void>;
}

const inputStyle = { padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 };
const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 13 };

export default function BuildForm({ onSubmit }: Props) {
  const [params] = useSearchParams();
  const exampleSlug = params.get("example");
  const example = exampleSlug ? buildExamples.find((e) => e.slug === exampleSlug) : undefined;

  const [mode, setMode] = useState<"new-companion" | "iterate-companion">(() =>
    example ? "new-companion" : params.get("mode") === "iterate" ? "iterate-companion" : "new-companion"
  );
  const [name, setName] = useState(example?.slug ?? "");
  const [kind, setKind] = useState<"entity" | "tool">(example?.kind ?? "entity");
  const [description, setDescription] = useState(example?.description ?? "");
  const [target, setTarget] = useState<string>(params.get("target") ?? "");
  const { companions } = useCompanions();
  const targets = companions.filter((c) => c.name !== "build");

  useEffect(() => {
    const sl = params.get("example");
    const ex = sl ? buildExamples.find((e) => e.slug === sl) : undefined;
    if (ex) {
      setMode("new-companion");
      setName(ex.slug);
      setKind(ex.kind);
      setDescription(ex.description);
      return;
    }
    if (params.get("mode") === "iterate" && params.get("target")) {
      setMode("iterate-companion");
      setTarget(params.get("target")!);
    }
  }, [params]);

  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const desc = description.trim();
    if (!desc) { setError("Description is required."); return; }
    if (mode === "new-companion") {
      const nm = name.trim();
      if (!nm) { setError("Companion name is required."); return; }
      if (!/^[a-z][a-z0-9-]*$/.test(nm)) { setError("Name must be lowercase letters, digits, hyphens; starts with a letter."); return; }
      setError(null);
      void onSubmit({ mode, name: nm, kind, description: desc });
    } else {
      if (!target) { setError("Pick a target companion."); return; }
      setError(null);
      void onSubmit({ mode, target, description: desc });
    }
  };

  const tabStyle = (active: boolean) => ({
    padding: "8px 14px",
    border: `1px solid ${active ? "var(--accent, #0284c7)" : "#cbd5e1"}`,
    background: active ? "var(--accent, #0284c7)" : "white",
    color: active ? "white" : "#334155",
    borderRadius: 6,
    cursor: "pointer" as const,
    fontSize: 13,
    fontWeight: 500,
  });

  return (
    <form onSubmit={submit} style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={tabStyle(mode === "new-companion")} onClick={() => setMode("new-companion")}>
          ✨ New companion
        </button>
        <button type="button" style={tabStyle(mode === "iterate-companion")} onClick={() => setMode("iterate-companion")}>
          ⟳ Iterate on existing
        </button>
      </div>

      {mode === "new-companion" ? (
        <>
          <label style={labelStyle}>
            Companion name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="oncall-investigator"
              style={inputStyle}
              pattern="^[a-z][a-z0-9-]*$"
            />
            <span style={{ fontSize: 11, color: "#64748b" }}>lowercase, hyphens, starts with a letter</span>
          </label>
          <label style={labelStyle}>
            Kind
            <select value={kind} onChange={(e) => setKind(e.target.value as "entity" | "tool")} style={inputStyle}>
              <option value="entity">entity — has lifecycle, form, artifacts</option>
              <option value="tool">tool — MCP tools only, auto About page</option>
            </select>
          </label>
        </>
      ) : (
        <label style={labelStyle}>
          Target companion
          <select value={target} onChange={(e) => setTarget(e.target.value)} style={inputStyle}>
            <option value="">— select —</option>
            {targets.map((t) => (
              <option key={t.name} value={t.name}>
                {t.icon} {t.displayName} <span>(v{t.version})</span>
              </option>
            ))}
          </select>
        </label>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={labelStyle}>
          {mode === "new-companion" ? "Description" : "What should change?"}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder={
              mode === "new-companion"
                ? "Describe the companion. Name the external service (GitHub, AWS, Linear, Slack, …), what data to fetch, and what the artifact should contain. Read-only by default — say explicitly if it should write back.\n\nExample: Review a GitHub PR — fetch the diff and existing comments, flag risky diffs, suggest review questions for the author. Read-only."
                : "Add a dim() tool that sets brightness to a number between 0 and 1."
            }
            style={{ ...inputStyle, resize: "vertical" as const }}
          />
        </label>
        {mode === "new-companion" && (
          <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
            Tip: companions get architectural value from authenticated proxy access to external systems. The form captures <strong>where</strong> to query (which repo / account / team / channel) — not "paste your text here."
          </span>
        )}
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn" type="submit" style={{ alignSelf: "flex-start" }}>
        {mode === "new-companion" ? "Build companion" : "Iterate"}
      </button>
    </form>
  );
}
