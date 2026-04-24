import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { BuildInput } from "./types";
import { useCompanions } from "../../src/client/hooks/useCompanions";

interface Props {
  onSubmit: (input: BuildInput) => void | Promise<void>;
}

const inputStyle = { padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 };
const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 13 };

export default function BuildForm({ onSubmit }: Props) {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"new-companion" | "iterate-companion">(
    params.get("mode") === "iterate" ? "iterate-companion" : "new-companion"
  );
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"entity" | "tool">("entity");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState<string>(params.get("target") ?? "");
  const { companions } = useCompanions();
  const targets = companions.filter((c) => c.name !== "build");

  useEffect(() => {
    if (params.get("mode") === "iterate" && params.get("target")) {
      setMode("iterate-companion");
      setTarget(params.get("target")!);
    }
  }, [params]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const desc = description.trim();
    if (!desc) return;
    if (mode === "new-companion") {
      const nm = name.trim();
      if (!nm || !/^[a-z][a-z0-9-]*$/.test(nm)) return;
      void onSubmit({ mode, name: nm, kind, description: desc });
    } else {
      if (!target) return;
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

      <label style={labelStyle}>
        {mode === "new-companion" ? "Description" : "What should change?"}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder={
            mode === "new-companion"
              ? "Triage oncall alerts from the last 24h and summarize the top three."
              : "Add a dim() tool that sets brightness to a number between 0 and 1."
          }
          style={{ ...inputStyle, resize: "vertical" as const }}
        />
      </label>

      <button className="btn" type="submit" style={{ alignSelf: "flex-start" }}>
        {mode === "new-companion" ? "Scaffold companion" : "Iterate"}
      </button>
    </form>
  );
}
