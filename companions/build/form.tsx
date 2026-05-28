import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import type { BuildInput } from "./types";
import { buildExamples, serializeBuildPrompt, type BuildFormField, type BuildToolSpec } from "./examples";
import { useCompanions } from "../../src/client/hooks/useCompanions";

interface Props {
  onSubmit: (input: BuildInput) => void | Promise<void>;
}

const EMPTY_FIELD: BuildFormField = { name: "", required: true, description: "" };
const EMPTY_TOOL: BuildToolSpec = { name: "", description: "", args: "" };

export default function BuildForm({ onSubmit }: Props) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const exampleSlug = params.get("example");
  const asideExample = exampleSlug ? (buildExamples.find((e) => e.slug === exampleSlug) ?? null) : null;

  // Legacy iterate URLs route through the dedicated /c/build/iterate/:target page.
  useEffect(() => {
    if (params.get("mode") === "iterate") {
      const tgt = params.get("target");
      navigate(tgt ? `/c/build/iterate/${tgt}` : "/c/build/evolve", { replace: true });
    }
  }, [params, navigate]);

  const [name, setName] = useState(asideExample?.slug ?? "");
  const [kind, setKind] = useState<"ui" | "tool">(asideExample?.kind ?? "ui");
  const [goal, setGoal] = useState(asideExample?.goal ?? "");
  const [formFields, setFormFields] = useState<BuildFormField[]>(
    asideExample?.kind === "ui" ? asideExample.formFields.map((f) => ({ ...f })) : [{ ...EMPTY_FIELD }]
  );
  const [artifactTemplate, setArtifactTemplate] = useState(
    asideExample?.kind === "ui" ? asideExample.artifactTemplate : ""
  );
  const [tools, setTools] = useState<BuildToolSpec[]>(
    asideExample?.kind === "tool" ? asideExample.tools.map((t) => ({ ...t })) : [{ ...EMPTY_TOOL }]
  );
  const [behavior, setBehavior] = useState(asideExample?.behavior ?? "");

  useEffect(() => {
    if (asideExample) {
      setName(asideExample.slug);
      setKind(asideExample.kind);
      setGoal(asideExample.goal);
      setBehavior(asideExample.behavior);
      if (asideExample.kind === "ui") {
        setFormFields(asideExample.formFields.map((f) => ({ ...f })));
        setArtifactTemplate(asideExample.artifactTemplate);
      } else {
        setTools(asideExample.tools.map((t) => ({ ...t })));
      }
    }
  }, [exampleSlug]);

  const { companions } = useCompanions();
  const trimmedName = name.trim();
  const nameTaken = trimmedName.length > 0 && companions.some((c) => c.name === trimmedName);

  const updateField = (i: number, patch: Partial<BuildFormField>) => {
    setFormFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };
  const addField = () => setFormFields((prev) => [...prev, { ...EMPTY_FIELD }]);
  const removeField = (i: number) => setFormFields((prev) => prev.filter((_, idx) => idx !== i));

  const updateTool = (i: number, patch: Partial<BuildToolSpec>) => {
    setTools((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };
  const addTool = () => setTools((prev) => [...prev, { ...EMPTY_TOOL }]);
  const removeTool = (i: number) => setTools((prev) => prev.filter((_, idx) => idx !== i));

  const description = kind === "ui"
    ? serializeBuildPrompt({ kind: "ui", goal, formFields, artifactTemplate, behavior })
    : serializeBuildPrompt({ kind: "tool", goal, tools, behavior });

  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const desc = description.trim();
    if (!desc) { setError("Goal is required — describe what this companion is for."); return; }
    const nm = name.trim();
    if (!nm) { setError("Companion name is required."); return; }
    if (!/^[a-z][a-z0-9-]*$/.test(nm)) { setError("Name must be lowercase letters, digits, hyphens; starts with a letter."); return; }
    if (nameTaken) { setError(`A companion named "${nm}" already exists. Pick a different name.`); return; }
    setError(null);
    void onSubmit({ mode: "new-companion", name: nm, kind, description: desc });
  };

  const sectionLabelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
  const inputBaseStyle: React.CSSProperties = {
    padding: "10px 12px",
    background: "var(--bg)",
    color: "var(--ink)",
    border: "1px solid color-mix(in srgb, var(--ink) 14%, transparent)",
    borderRadius: 8,
    fontFamily: "var(--font-body)",
    fontSize: 14,
    lineHeight: 1.55,
  };
  const textareaStyle: React.CSSProperties = { ...inputBaseStyle, resize: "vertical", minHeight: 100 };

  return (
    <div style={{ maxWidth: 920 }}>
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
              ? "Prefilled from the example chip. Review each section below and adjust before submitting — Build will scaffold the manifest, MCP proxy tools, skill, and pages."
              : "Fill in the four sections below. Build interprets them and scaffolds everything — manifest, MCP proxy tools, skill, and pages."}
          </p>
        </div>

        {asideExample ? (
          <div className="card-hairline" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "color-mix(in srgb, var(--sage) 8%, transparent)", borderColor: "color-mix(in srgb, var(--sage) 30%, transparent)" }}>
            <span style={{ fontSize: 22 }} aria-hidden>{asideExample.icon}</span>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="t-h3">Starting from example</span>
              <span className="t-caption">{asideExample.displayName}</span>
            </div>
            <button type="button" onClick={() => navigate("/c/build/new")} className="t-caption" style={{ background: "transparent", border: 0, color: "var(--accent)", cursor: "pointer" }}>clear ↗</button>
          </div>
        ) : (
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span className="t-eyebrow">Or start from an example</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {buildExamples.map((ex) => (
                <button
                  key={ex.slug}
                  type="button"
                  className="card-hairline"
                  onClick={() => navigate(`?example=${ex.slug}`)}
                  title={ex.description.split(".")[0] + "."}
                  style={{ textAlign: "left", cursor: "pointer", background: "transparent", display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}
                >
                  <span style={{ fontSize: 20 }} aria-hidden>{ex.icon}</span>
                  <span className="t-h3">{ex.displayName}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={sectionLabelStyle}>
              <label htmlFor="build-name" className="t-eyebrow">Companion name</label>
              <input
                id="build-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="oncall-investigator"
                pattern="^[a-z][a-z0-9-]*$"
                style={{ ...inputBaseStyle, fontFamily: "var(--font-mono)" }}
              />
              {nameTaken ? (
                <span className="t-caption" role="alert" style={{ color: "var(--status-error)" }}>
                  A companion named “{trimmedName}” already exists — pick a different name.
                </span>
              ) : (
                <span className="t-caption">lowercase · hyphens only · starts with a letter</span>
              )}
            </div>

            <div style={sectionLabelStyle}>
              <span className="t-eyebrow" id="kind-label">Kind</span>
              <div role="radiogroup" aria-labelledby="kind-label" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { value: "ui" as const, label: "ui companion", hint: "form, lifecycle, artifacts" },
                  { value: "tool" as const, label: "tool companion", hint: "MCP tools only, auto About page" },
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

            <div style={sectionLabelStyle}>
              <label htmlFor="build-goal" className="t-eyebrow">Goal</label>
              <textarea
                id="build-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={4}
                placeholder="What is this companion for / what does it produce? Name the external service (GitHub, AWS, Linear, Slack, …), what data to fetch, and what the artifact represents. Read-only by default — say explicitly if it should write back."
                style={textareaStyle}
              />
              <span className="t-caption">One short paragraph. Build uses this as the headline framing.</span>
            </div>

            {kind === "ui" && (
            <div style={sectionLabelStyle}>
              <span className="t-eyebrow" id="form-fields-label">Form fields</span>
              <span className="t-caption" style={{ marginBottom: 4 }}>
                The fields the companion's form will collect. Be specific about format and defaults — Build will turn each into a Zod field with the matching UI hints.
              </span>
              <div role="group" aria-labelledby="form-fields-label" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {formFields.map((f, i) => (
                  <div key={i} className="card-hairline" style={{ display: "grid", gridTemplateColumns: "200px 110px 1fr auto", gap: 8, alignItems: "start", padding: "10px 12px" }}>
                    <input
                      aria-label={`Field ${i + 1} name`}
                      value={f.name}
                      onChange={(e) => updateField(i, { name: e.target.value })}
                      placeholder="field name"
                      style={{ ...inputBaseStyle, fontFamily: "var(--font-mono)", padding: "8px 10px" }}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) => updateField(i, { required: e.target.checked })}
                      />
                      required
                    </label>
                    <textarea
                      aria-label={`Field ${i + 1} description`}
                      value={f.description}
                      onChange={(e) => updateField(i, { description: e.target.value })}
                      rows={3}
                      placeholder="What this field is, expected format, defaults. e.g. 'owner/name format, e.g. sean1588/claudepanion'"
                      style={{ ...textareaStyle, minHeight: 84, padding: "8px 10px" }}
                    />
                    <button
                      type="button"
                      onClick={() => removeField(i)}
                      disabled={formFields.length === 1}
                      aria-label={`Remove field ${i + 1}`}
                      title="Remove field"
                      style={{
                        background: "transparent",
                        border: "1px solid color-mix(in srgb, var(--ink) 14%, transparent)",
                        borderRadius: 6,
                        color: "var(--muted)",
                        cursor: formFields.length === 1 ? "not-allowed" : "pointer",
                        opacity: formFields.length === 1 ? 0.4 : 1,
                        padding: "6px 10px",
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addField}
                  className="t-caption"
                  style={{
                    alignSelf: "flex-start",
                    background: "transparent",
                    border: "1px dashed color-mix(in srgb, var(--ink) 24%, transparent)",
                    borderRadius: 6,
                    color: "var(--accent)",
                    cursor: "pointer",
                    padding: "6px 12px",
                  }}
                >
                  + add field
                </button>
              </div>
            </div>
            )}

            {kind === "ui" && (
            <div style={sectionLabelStyle}>
              <label htmlFor="build-artifact" className="t-eyebrow">Artifact template</label>
              <textarea
                id="build-artifact"
                value={artifactTemplate}
                onChange={(e) => setArtifactTemplate(e.target.value)}
                rows={8}
                placeholder={`Sketch the artifact's sections, in markdown. e.g.\n\n1. **Verdict** — 1-2 sentence overall take.\n2. **Risks** — bullets, each citing file:line.\n3. **Address before merge** — grouped Major / Minor / Nits.`}
                style={{ ...textareaStyle, minHeight: 160, fontFamily: "var(--font-mono)", fontSize: 13 }}
              />
              <span className="t-caption">Free-form markdown. The scaffolded skill will follow this shape on every run.</span>
            </div>
            )}

            {kind === "tool" && (
            <div style={sectionLabelStyle}>
              <span className="t-eyebrow" id="tools-label">Tools</span>
              <span className="t-caption" style={{ marginBottom: 4 }}>
                The MCP tools this companion will expose. Build will turn each into a <code>defineTool</code> entry. Args are optional — describe them in plain text (name, type, required/optional, default).
              </span>
              <div role="group" aria-labelledby="tools-label" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tools.map((t, i) => (
                  <div key={i} className="card-hairline" style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr auto", gap: 8, alignItems: "start" }}>
                      <input
                        aria-label={`Tool ${i + 1} name`}
                        value={t.name}
                        onChange={(e) => updateTool(i, { name: e.target.value })}
                        placeholder="tool_name (snake_case)"
                        style={{ ...inputBaseStyle, fontFamily: "var(--font-mono)", padding: "8px 10px" }}
                      />
                      <textarea
                        aria-label={`Tool ${i + 1} description`}
                        value={t.description}
                        onChange={(e) => updateTool(i, { description: e.target.value })}
                        rows={2}
                        placeholder="What this tool does + when to use it. Read-only unless stated; if it writes, say so explicitly."
                        style={{ ...textareaStyle, minHeight: 56, padding: "8px 10px" }}
                      />
                      <button
                        type="button"
                        onClick={() => removeTool(i)}
                        disabled={tools.length === 1}
                        aria-label={`Remove tool ${i + 1}`}
                        title="Remove tool"
                        style={{
                          background: "transparent",
                          border: "1px solid color-mix(in srgb, var(--ink) 14%, transparent)",
                          borderRadius: 6,
                          color: "var(--muted)",
                          cursor: tools.length === 1 ? "not-allowed" : "pointer",
                          opacity: tools.length === 1 ? 0.4 : 1,
                          padding: "6px 10px",
                          fontFamily: "var(--font-mono)",
                          fontSize: 13,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    <textarea
                      aria-label={`Tool ${i + 1} args`}
                      value={t.args}
                      onChange={(e) => updateTool(i, { args: e.target.value })}
                      rows={4}
                      placeholder={`Args (optional). e.g.\nurl: string (required) — URL to fetch\ntimeout_ms: number (optional, default 5000)`}
                      style={{ ...textareaStyle, minHeight: 96, padding: "8px 10px", fontFamily: "var(--font-mono)", fontSize: 13 }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addTool}
                  className="t-caption"
                  style={{
                    alignSelf: "flex-start",
                    background: "transparent",
                    border: "1px dashed color-mix(in srgb, var(--ink) 24%, transparent)",
                    borderRadius: 6,
                    color: "var(--accent)",
                    cursor: "pointer",
                    padding: "6px 12px",
                  }}
                >
                  + add tool
                </button>
              </div>
            </div>
            )}

            <div style={sectionLabelStyle}>
              <label htmlFor="build-behavior" className="t-eyebrow">Behavior & constraints</label>
              <textarea
                id="build-behavior"
                value={behavior}
                onChange={(e) => setBehavior(e.target.value)}
                rows={4}
                placeholder="Read-only by default? Auth source (env var, ~/.aws/credentials, etc)? Any defaults Build should bake in?"
                style={textareaStyle}
              />
              <span className="t-caption">
                Anything Build should know about side-effects, auth, defaults, or framework escape hatches (e.g. needing a custom form.tsx for searchable dropdowns).
              </span>
            </div>

            {error && <div className="form-error" role="alert" style={{ color: "var(--status-error)" }}>{error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn-ink" type="submit">Build companion</button>
            </div>
          </form>
      </div>
    </div>
  );
}
