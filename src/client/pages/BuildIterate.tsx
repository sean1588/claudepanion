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

  useEffect(() => {
    if (loading) return;
    if (!targetManifest || target === "build") navigate("/c/build/evolve", { replace: true });
  }, [loading, targetManifest, target, navigate]);

  if (loading || !targetManifest) {
    return <div style={{ padding: 24, color: "var(--muted)" }}>Loading…</div>;
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
    <div style={{ padding: "22px 28px 60px", maxWidth: 720 }}>
      <div style={{ marginBottom: 22 }}>
        <div className="wb-section-label" style={{ marginBottom: 8 }}>
          $ build iterate-companion --target {target}
        </div>
        <h1 className="wb-serif" style={{ fontSize: 44, lineHeight: 1.05, margin: "0 0 10px" }}>
          Evolving <em>{targetManifest.icon} {targetManifest.displayName}</em>
        </h1>
        <p className="wb-sans" style={{ color: "var(--muted)", margin: 0, fontSize: 13, lineHeight: 1.55, maxWidth: 640 }}>
          Describe what should change. Build diffs your description against the current manifest, MCP tools, skill, and pages — and ships a focused patch.
        </p>
      </div>

      <div
        className="wb-card"
        style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <span style={{ fontSize: 20 }} aria-hidden>{targetManifest.icon}</span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="wb-sans" style={{ fontSize: 13, fontWeight: 600 }}>{targetManifest.displayName}</span>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 11 }}>v{targetManifest.version}</span>
        </div>
        <Link to="/c/build/evolve" className="wb-btn wb-btn-ghost wb-btn-sm" style={{ textDecoration: "none" }}>
          change ↗
        </Link>
      </div>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
            what should change?
          </div>
          <textarea
            id="iterate-description"
            aria-label="What should change?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="// e.g. add a dim() tool that sets brightness to a number between 0 and 1"
            className="wb-input wb-textarea"
            style={{ minHeight: 160 }}
          />
        </div>

        {error && (
          <div role="alert" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--status-error)" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={submitting} className="wb-btn">
            {submitting ? "submitting…" : "$ iterate"}
          </button>
          <Link to="/c/build/evolve" className="wb-btn wb-btn-ghost" style={{ textDecoration: "none" }}>cancel</Link>
        </div>
      </form>
    </div>
  );
}
