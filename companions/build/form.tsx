import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { BuildInput } from "./types";
import { buildExamples } from "./examples";
import { useCompanions } from "../../src/client/hooks/useCompanions";

interface Props {
  onSubmit: (input: BuildInput) => void | Promise<void>;
}

const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 6, fontSize: 13, fontWeight: 500 };
const fieldStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid rgba(21, 24, 26, 0.15)",
  borderRadius: 6,
  background: "var(--bg)",
  color: "var(--ink)",
  fontSize: 14,
  fontFamily: "inherit" as const,
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};
const monoFieldStyle = {
  ...fieldStyle,
  fontFamily: "var(--font-mono)" as const,
};

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
    padding: "8px 18px",
    borderRadius: 6,
    cursor: "pointer" as const,
    fontSize: 13,
    fontWeight: 500,
    border: `1px solid ${active ? "var(--ink)" : "rgba(21, 24, 26, 0.15)"}`,
    background: active ? "var(--ink)" : "transparent",
    color: active ? "var(--bg)" : "var(--muted)",
    fontFamily: "inherit" as const,
    transition: "background 0.15s ease, color 0.15s ease",
  });

  const kindCardStyle = (selected: boolean) => ({
    flex: 1,
    padding: "12px 14px",
    textAlign: "left" as const,
    cursor: "pointer" as const,
    border: `1px solid ${selected ? "var(--sage)" : "rgba(21, 24, 26, 0.1)"}`,
    borderRadius: 6,
    background: selected ? "rgba(122, 135, 136, 0.1)" : "transparent",
    fontFamily: "inherit" as const,
    color: "inherit" as const,
  });

  return (
    <form onSubmit={submit} style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 22 }}>
      <h1 className="serif" style={{ fontSize: 48, lineHeight: 1.0, margin: 0 }}>
        {mode === "new-companion" ? (
          <>Build a new <span className="serif-italic" style={{ color: "var(--accent)" }}>companion</span>.</>
        ) : (
          <>Iterate on a <span className="serif-italic" style={{ color: "var(--accent)" }}>companion</span>.</>
        )}
      </h1>
      <p style={{ fontSize: 15, color: "var(--muted)", margin: 0, maxWidth: 560, lineHeight: 1.55 }}>
        {mode === "new-companion"
          ? "Describe the tool you want. Name the external service, what data to fetch, and what the output should look like. Build interprets the description and scaffolds everything from there."
          : "Pick a target companion and describe the change. Build edits files in place and bumps the version."}
      </p>

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
              style={monoFieldStyle}
              pattern="^[a-z][a-z0-9-]*$"
            />
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>lowercase · hyphens only · starts with a letter</span>
          </label>

          <div role="radiogroup" aria-label="Kind" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Kind</span>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                role="radio"
                aria-checked={kind === "entity"}
                style={kindCardStyle(kind === "entity")}
                onClick={() => setKind("entity")}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>entity</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>form, lifecycle, artifacts</div>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={kind === "tool"}
                style={kindCardStyle(kind === "tool")}
                onClick={() => setKind("tool")}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>tool</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>MCP tools only, auto About page</div>
              </button>
            </div>
          </div>
        </>
      ) : (
        <label style={labelStyle}>
          Target companion
          <select value={target} onChange={(e) => setTarget(e.target.value)} style={fieldStyle}>
            <option value="">— select —</option>
            {targets.map((t) => (
              <option key={t.name} value={t.name}>
                {t.icon} {t.displayName} (v{t.version})
              </option>
            ))}
          </select>
        </label>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={labelStyle}>
          {mode === "new-companion" ? "Description" : "What should change?"}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={mode === "new-companion" ? 7 : 5}
            placeholder={
              mode === "new-companion"
                ? "Describe the companion. Name the external service (GitHub, AWS, Linear, Slack, …), what data to fetch, and what the artifact should contain. Read-only by default — say explicitly if it should write back.\n\nExample: Review a GitHub PR — fetch the diff and existing comments, flag risky diffs, suggest review questions for the author. Read-only."
                : "Add a dim() tool that sets brightness to a number between 0 and 1."
            }
            style={{ ...fieldStyle, resize: "vertical" as const, lineHeight: 1.6 }}
          />
        </label>
        {mode === "new-companion" && (
          <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
            Tip: companions get architectural value from <strong style={{ color: "var(--ink)" }}>authenticated proxy access</strong> to external systems. The form captures <em>where</em> to query (which repo / account / team / channel) — not "paste your text here."
          </span>
        )}
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}

      <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 4 }}>
        <button className="btn" type="submit">
          {mode === "new-companion" ? "Build companion →" : "Iterate →"}
        </button>
        <button type="button" className="btn-outline" onClick={() => window.history.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
