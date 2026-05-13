import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import type { BuildInput } from "./types";
import { buildExamples } from "./examples";
import { useCompanions } from "../../src/client/hooks/useCompanions";
import BuildAside from "../../src/client/components/BuildAside";

interface Props {
  onSubmit: (input: BuildInput) => void | Promise<void>;
}

export default function BuildForm({ onSubmit }: Props) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const exampleSlug = params.get("example");
  const asideExample = exampleSlug ? (buildExamples.find((e) => e.slug === exampleSlug) ?? null) : null;
  const example = asideExample;

  const [mode, setMode] = useState<"new-companion" | "iterate-companion">(() =>
    example ? "new-companion" : params.get("mode") === "iterate" ? "iterate-companion" : "new-companion"
  );
  const [name, setName] = useState(example?.slug ?? "");
  const [kind, setKind] = useState<"ui" | "tool">(example?.kind ?? "ui");
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

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="t-mono" style={{ color: "var(--muted)", marginBottom: 24 }}>
        claudepanion › <Link to="/c/build" style={{ color: "var(--muted)", textDecoration: "none" }}>Build</Link> › New companion
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        <div>
          {asideExample ? (
            <h1 className="t-display-sm" style={{ margin: "16px 0 8px" }}>
              Scaffolding <em className="t-accent-italic">{asideExample.icon} {asideExample.displayName}</em>
            </h1>
          ) : (
            <h1 className="t-display-sm" style={{ margin: "16px 0 8px" }}>
              Build a new <em className="t-accent-italic">companion</em>.
            </h1>
          )}
          <p className="t-body" style={{ color: "var(--muted)", margin: 0, maxWidth: "62ch" }}>
            {asideExample
              ? "Prefilled from the example chip. Review the description below and adjust any details before submitting — Build will scaffold the manifest, MCP proxy tools, skill, and pages."
              : "Describe the tool you want. Name the external service, what data to fetch, and what the output should look like. Build interprets the description and scaffolds everything from there."}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 32, alignItems: "start" }}>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setMode("new-companion")}
                className="btn-chip"
                style={mode === "new-companion"
                  ? { background: "var(--ink)", color: "var(--bg)", padding: "8px 14px", borderRadius: 999, border: 0, fontSize: 13, fontWeight: 500, cursor: "pointer" }
                  : { padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
              >
                ✨ New companion
              </button>
              <button
                type="button"
                onClick={() => setMode("iterate-companion")}
                className="btn-chip"
                style={mode === "iterate-companion"
                  ? { background: "var(--ink)", color: "var(--bg)", padding: "8px 14px", borderRadius: 999, border: 0, fontSize: 13, fontWeight: 500, cursor: "pointer" }
                  : { padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
              >
                ⟳ Iterate on existing
              </button>
            </div>

            {mode === "new-companion" ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="build-name" className="t-eyebrow">Companion name</label>
                  <input
                    id="build-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="oncall-investigator"
                    pattern="^[a-z][a-z0-9-]*$"
                    style={{
                      padding: "10px 12px",
                      background: "var(--bg)",
                      color: "var(--ink)",
                      border: "1px solid color-mix(in srgb, var(--ink) 14%, transparent)",
                      borderRadius: 8,
                      fontFamily: "var(--font-mono)",
                      fontSize: 14,
                    }}
                  />
                  <span className="t-caption">lowercase · hyphens only · starts with a letter</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span className="t-eyebrow" id="kind-label">Kind</span>
                  <div role="radiogroup" aria-labelledby="kind-label" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      { value: "ui" as const, label: "entity", hint: "form, lifecycle, artifacts" },
                      { value: "tool" as const, label: "tool", hint: "MCP tools only, auto About page" },
                    ].map((opt) => {
                      const selected = kind === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setKind(opt.value)}
                          className="card-hairline"
                          style={{
                            textAlign: "left",
                            cursor: "pointer",
                            borderColor: selected ? "var(--accent)" : undefined,
                            background: selected ? "color-mix(in srgb, var(--accent) 6%, transparent)" : undefined,
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <span className="t-h3">{opt.label}</span>
                          <span className="t-caption">{opt.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="t-eyebrow">Target companion</span>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    background: "var(--bg)",
                    color: "var(--ink)",
                    border: "1px solid color-mix(in srgb, var(--ink) 14%, transparent)",
                    borderRadius: 8,
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                  }}
                >
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
              <label htmlFor="build-description" className="t-eyebrow">
                {mode === "new-companion" ? "Description" : "What should change?"}
              </label>
              <textarea
                id="build-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder={mode === "new-companion"
                  ? "Describe the companion. Name the external service (GitHub, AWS, Linear, Slack, …), what data to fetch, and what the artifact should contain. Read-only by default — say explicitly if it should write back.\n\nExample: Review a GitHub PR — fetch the diff and existing comments, flag risky diffs, suggest review questions for the author. Read-only."
                  : "Add a dim() tool that sets brightness to a number between 0 and 1."}
                style={{
                  padding: "10px 12px",
                  background: "var(--bg)",
                  color: "var(--ink)",
                  border: "1px solid color-mix(in srgb, var(--ink) 14%, transparent)",
                  borderRadius: 8,
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  lineHeight: 1.55,
                  resize: "vertical",
                  minHeight: 160,
                }}
              />
              {mode === "new-companion" && (
                <span className="t-caption">
                  Tip: companions get architectural value from authenticated proxy access to external systems. The form captures <strong>where</strong> to query (which repo / account / team / channel) — not "paste your text here."
                </span>
              )}
            </div>

            {error && <div className="form-error" role="alert" style={{ color: "var(--status-error)" }}>{error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn-ink" type="submit">
                {mode === "new-companion" ? "Build companion" : "Iterate"}
              </button>
            </div>
          </form>

          <BuildAside example={asideExample} onPick={(slug) => navigate(`?example=${slug}`)} />
        </div>
      </div>
    </div>
  );
}
