import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCompanions } from "../hooks/useCompanions";
import { createEntity } from "../api";

export default function BuildIterate() {
  const { target = "" } = useParams<{ target: string }>();
  const navigate = useNavigate();
  const { companions, loading } = useCompanions();
  const targetManifest = companions.find((c) => c.name === target) ?? null;

  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect to the picker if the target slug doesn't resolve to a real
  // companion. We wait for the companions list to load before redirecting so
  // we don't bounce on cold mount.
  useEffect(() => {
    if (loading) return;
    if (!targetManifest || target === "build") navigate("/c/build/evolve", { replace: true });
  }, [loading, targetManifest, target, navigate]);

  if (loading || !targetManifest) {
    return <div style={{ color: "var(--muted)" }}>Loading…</div>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const desc = description.trim();
    if (!desc) { setError("Describe what should change."); return; }
    setError(null);
    setSubmitting(true);
    try {
      const entity = await createEntity("build", { mode: "iterate-companion", target, description: desc });
      navigate(`/c/build/${entity.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 32 }}>
      <div className="t-mono" style={{ color: "var(--muted)" }}>
        <Link to="/" style={{ color: "var(--muted)", textDecoration: "none" }}>claudepanion</Link>
        {" › "}
        <Link to="/c/build" style={{ color: "var(--muted)", textDecoration: "none" }}>Build</Link>
        {" › "}
        <Link to="/c/build/evolve" style={{ color: "var(--muted)", textDecoration: "none" }}>Evolve</Link>
        {" › "}
        <span>{targetManifest.displayName}</span>
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="pill pill-eyebrow" style={{ alignSelf: "flex-start" }}>⟳ ITERATE ON EXISTING</span>
        <h1 className="t-display-sm" style={{ margin: 0 }}>
          Evolving <em className="t-accent-italic">{targetManifest.icon} {targetManifest.displayName}</em>
        </h1>
        <p className="t-body" style={{ color: "var(--muted)", margin: 0, maxWidth: "62ch" }}>
          Describe what should change. Build will diff your description against the current manifest, MCP proxy tools,
          skill, and pages — and ship a focused patch.
        </p>
      </section>

      <div className="card-hairline" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
        <span style={{ fontSize: 22 }} aria-hidden>{targetManifest.icon}</span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="t-h3">{targetManifest.displayName}</span>
          <span className="t-mono" style={{ color: "var(--muted)", fontSize: 11 }}>v{targetManifest.version}</span>
        </div>
        <Link to="/c/build/evolve" className="t-caption" style={{ color: "var(--accent)" }}>change ↗</Link>
      </div>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="iterate-description" className="t-eyebrow">What should change?</label>
          <textarea
            id="iterate-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="Add a dim() tool that sets brightness to a number between 0 and 1."
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
        </div>

        {error && <div role="alert" style={{ color: "var(--status-error)" }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button className="btn-ink" type="submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Iterate"}
          </button>
          <Link to="/c/build/evolve" className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
