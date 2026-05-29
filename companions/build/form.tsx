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

  const targetSlug = trimmedName || "your-companion";

  return (
    <div style={{ padding: "28px 24px 48px", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
          {asideExample ? `$ build new-companion --from ${asideExample.slug}` : "$ build new-companion"}
        </div>
        <h1 className="wb-serif" style={{ fontSize: 44, lineHeight: 1.05, margin: "0 0 10px" }}>
          {asideExample
            ? <><span aria-hidden>{asideExample.icon}</span> <em>{asideExample.displayName}</em></>
            : <>New <em>companion</em>.</>
          }
        </h1>
        <p className="wb-sans" style={{ fontSize: 14, color: "var(--muted)", margin: 0, maxWidth: 640, lineHeight: 1.55 }}>
          {asideExample
            ? "Prefilled from the example chip. Review each section below and adjust before submitting — Build scaffolds the manifest, MCP tools, skill, and pages."
            : "Fill in the sections below. Build interprets them and scaffolds the manifest, MCP tools, skill, and pages."}
        </p>
      </div>

      {asideExample && (
        <div className="wb-card" style={{ marginBottom: 18, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, background: "color-mix(in srgb, var(--sage) 8%, transparent)", borderColor: "var(--sage)" }}>
          <span style={{ fontSize: 20 }} aria-hidden>{asideExample.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>starting from example · <span style={{ color: "var(--muted)" }}>{asideExample.displayName}</span></div>
          </div>
          <button type="button" onClick={() => navigate("/c/build/new")} className="wb-btn wb-btn-ghost wb-btn-sm">clear ↗</button>
        </div>
      )}

      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24, alignItems: "start" }}>
        {/* Form column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Name */}
          <Field label="name · lowercase, hyphens, starts with a letter">
            <input
              id="build-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="oncall-investigator"
              pattern="^[a-z][a-z0-9-]*$"
              className="wb-input"
              aria-label="Companion name"
            />
            {nameTaken && (
              <Caption color="error">
                A companion named "{trimmedName}" already exists — pick a different name.
              </Caption>
            )}
          </Field>

          {/* Kind */}
          <div>
            <FieldLabel>kind</FieldLabel>
            <div role="radiogroup" aria-labelledby="kind-label" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
                    style={{
                      padding: "10px 12px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                      border: "var(--app-border)",
                      borderColor: selected ? "var(--sage)" : "color-mix(in srgb, var(--ink) 30%, transparent)",
                      background: selected ? "color-mix(in srgb, var(--sage) 10%, transparent)" : "transparent",
                      color: "var(--ink)",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{opt.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Goal */}
          <Field label="goal · what is this companion for / what does it produce">
            <textarea
              id="build-goal"
              aria-label="Goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={4}
              placeholder="// what is this companion for / what does it produce?&#10;// name the external service (GitHub, AWS, Linear, ...)&#10;// read-only by default — say so explicitly if it should write back"
              className="wb-input wb-textarea"
            />
          </Field>

          {/* UI mode: Form fields + Artifact template */}
          {kind === "ui" && (
            <Field label="form fields · the fields the companion's form collects">
              <div role="group" aria-labelledby="form-fields-label" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {formFields.map((f, i) => (
                  <div key={i} className="wb-card" style={{ padding: "10px 12px", display: "grid", gridTemplateColumns: "180px 110px 1fr 32px", gap: 8, alignItems: "start" }}>
                    <input
                      aria-label={`Field ${i + 1} name`}
                      value={f.name}
                      onChange={(e) => updateField(i, { name: e.target.value })}
                      placeholder="field_name"
                      className="wb-input"
                      style={{ padding: "6px 10px" }}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", padding: "8px 0" }}>
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
                      placeholder="// what this field is, expected format, defaults"
                      className="wb-input wb-textarea"
                      style={{ minHeight: 80, padding: "6px 10px" }}
                    />
                    <button
                      type="button"
                      onClick={() => removeField(i)}
                      disabled={formFields.length === 1}
                      aria-label={`Remove field ${i + 1}`}
                      title="Remove field"
                      className="wb-btn wb-btn-ghost wb-btn-sm"
                      style={{ padding: "6px 10px", borderColor: "color-mix(in srgb, var(--ink) 20%, transparent)" }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addField}
                  style={{
                    alignSelf: "flex-start",
                    background: "transparent",
                    border: "1px dashed color-mix(in srgb, var(--ink) 30%, transparent)",
                    borderRadius: 0,
                    color: "var(--accent)",
                    cursor: "pointer",
                    padding: "6px 12px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                  }}
                >
                  + add field
                </button>
              </div>
            </Field>
          )}

          {kind === "ui" && (
            <Field label="artifact template · markdown sketch of the artifact's sections">
              <textarea
                id="build-artifact"
                aria-label="Artifact template"
                value={artifactTemplate}
                onChange={(e) => setArtifactTemplate(e.target.value)}
                rows={8}
                placeholder={`// sketch the artifact's sections, in markdown\n// 1. **Verdict** — 1-2 sentence overall take\n// 2. **Risks** — bullets, each citing file:line\n// 3. **Address before merge** — Major / Minor / Nits`}
                className="wb-input wb-textarea"
                style={{ minHeight: 160 }}
              />
            </Field>
          )}

          {/* Tool mode: Tools */}
          {kind === "tool" && (
            <Field label="tools · the MCP tools this companion exposes">
              <div role="group" aria-labelledby="tools-label" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tools.map((t, i) => (
                  <div key={i} className="wb-card" style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 32px", gap: 8, alignItems: "start" }}>
                      <input
                        aria-label={`Tool ${i + 1} name`}
                        value={t.name}
                        onChange={(e) => updateTool(i, { name: e.target.value })}
                        placeholder="tool_name (snake_case)"
                        className="wb-input"
                        style={{ padding: "6px 10px" }}
                      />
                      <textarea
                        aria-label={`Tool ${i + 1} description`}
                        value={t.description}
                        onChange={(e) => updateTool(i, { description: e.target.value })}
                        rows={3}
                        placeholder="// what this tool does + when to use it&#10;// read-only unless stated; say explicitly if it writes"
                        className="wb-input wb-textarea"
                        style={{ minHeight: 80, padding: "6px 10px" }}
                      />
                      <button
                        type="button"
                        onClick={() => removeTool(i)}
                        disabled={tools.length === 1}
                        aria-label={`Remove tool ${i + 1}`}
                        title="Remove tool"
                        className="wb-btn wb-btn-ghost wb-btn-sm"
                        style={{ padding: "6px 10px", borderColor: "color-mix(in srgb, var(--ink) 20%, transparent)" }}
                      >
                        ✕
                      </button>
                    </div>
                    <textarea
                      aria-label={`Tool ${i + 1} args`}
                      value={t.args}
                      onChange={(e) => updateTool(i, { args: e.target.value })}
                      rows={4}
                      placeholder={`// args (optional). e.g.\n// url: string (required) — URL to fetch\n// timeout_ms: number (optional, default 5000)`}
                      className="wb-input wb-textarea"
                      style={{ minHeight: 96, padding: "6px 10px" }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addTool}
                  style={{
                    alignSelf: "flex-start",
                    background: "transparent",
                    border: "1px dashed color-mix(in srgb, var(--ink) 30%, transparent)",
                    borderRadius: 0,
                    color: "var(--accent)",
                    cursor: "pointer",
                    padding: "6px 12px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                  }}
                >
                  + add tool
                </button>
              </div>
            </Field>
          )}

          {/* Behavior */}
          <Field label="behavior & constraints · auth, read-only, defaults">
            <textarea
              id="build-behavior"
              aria-label="Behavior & constraints"
              value={behavior}
              onChange={(e) => setBehavior(e.target.value)}
              rows={4}
              placeholder="// read-only by default?&#10;// auth source (env var, ~/.aws/credentials, etc)?&#10;// any defaults Build should bake in?"
              className="wb-input wb-textarea"
            />
          </Field>

          {error && <div className="form-error" role="alert" style={{ color: "var(--status-error)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{error}</div>}

          <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
            <button className="wb-btn" type="submit">$ submit → claude scaffolds</button>
            <Link to="/c/build" className="wb-btn wb-btn-ghost" style={{ textDecoration: "none" }}>cancel</Link>
          </div>
        </div>

        {/* Aside: file tree of what Build will create + tip */}
        <aside style={{ position: "sticky", top: 16 }}>
          <div className="wb-card">
            <div className="wb-card-header wb-section-label">what build will create</div>
            <pre style={{ margin: 0, padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", lineHeight: 1.8 }}>{`companions/
  ${targetSlug}/
    manifest.ts
    index.ts
${kind === "ui" ? `    types.ts
    form.tsx
    pages/
      List.tsx
      Detail.tsx
` : ""}    server/
      tools.ts
skills/
  ${targetSlug}-companion/
    SKILL.md`}
            </pre>
            <div style={{ borderTop: "1px dashed color-mix(in srgb, var(--ink) 20%, transparent)", padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", lineHeight: 1.6 }}>
              // after submit: pending entity appears.<br />
              // run <span style={{ color: "var(--accent)" }}>/build-companion &lt;id&gt;</span><br />
              // in claude code → builds + mounts.
            </div>
          </div>

          {!asideExample && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--bg)", border: "1px dashed color-mix(in srgb, var(--ink) 30%, transparent)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", lineHeight: 1.7 }}>
              // tip: name the external system.<br />
              // companions work best with<br />
              // authenticated proxy access —<br />
              // not "paste text here."
            </div>
          )}

          {!asideExample && (
            <div className="wb-card" style={{ marginTop: 14 }}>
              <div className="wb-card-header wb-section-label">or start from</div>
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {buildExamples.map((ex) => (
                  <button
                    key={ex.slug}
                    type="button"
                    onClick={() => navigate(`?example=${ex.slug}`)}
                    title={ex.description.split(".")[0] + "."}
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--ink)",
                      background: "transparent",
                      border: "var(--app-border)",
                      borderColor: "color-mix(in srgb, var(--ink) 20%, transparent)",
                      cursor: "pointer",
                    }}
                  >
                    <span aria-hidden>{ex.icon}</span>
                    <span>{ex.slug}</span>
                    <span style={{ marginLeft: "auto", color: "var(--muted)" }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
      {children}
    </div>
  );
}

function Caption({ color = "muted", children }: { color?: "muted" | "error"; children: React.ReactNode }) {
  const c = color === "error" ? "var(--status-error)" : "var(--muted)";
  return (
    <div role={color === "error" ? "alert" : undefined} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: c, marginTop: 4 }}>
      {children}
    </div>
  );
}
