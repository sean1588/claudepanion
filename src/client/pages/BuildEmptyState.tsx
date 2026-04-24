import { useNavigate } from "react-router-dom";
import { buildExamples, type BuildExample } from "../../../companions/build/examples";

export default function BuildEmptyState() {
  const navigate = useNavigate();

  const openExample = (ex: BuildExample) => {
    navigate(`/c/build/new?example=${ex.slug}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 820 }}>
      <div
        style={{
          border: "1px solid #bae6fd",
          background: "linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)",
          borderRadius: 10,
          padding: "20px 22px",
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 600, color: "#0c4a6e", marginBottom: 8 }}>
          👋 Hi, I'm Build — your first companion.
        </div>
        <p style={{ fontSize: 13, color: "#1e293b", margin: 0, lineHeight: 1.55 }}>
          I scaffold new companions from a plain-English description. Everything else you add to the sidebar came from me. Try one of the ideas below, or describe your own.
        </p>
      </div>

      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
        Ideas to start from
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {buildExamples.map((ex, i) => (
          <button
            key={ex.slug}
            type="button"
            data-testid="chip"
            onClick={() => openExample(ex)}
            style={{
              padding: "12px 14px",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              background: "#fff",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              cursor: "pointer",
              textAlign: "left",
              gridColumn: i === buildExamples.length - 1 && buildExamples.length % 2 === 1 ? "span 2" : undefined,
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden="true">{ex.icon}</span>
            <span>
              <span style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{ex.displayName}</span>
              <span style={{ display: "block", fontSize: 12, color: "#475569", marginTop: 2, lineHeight: 1.4 }}>{ex.description}</span>
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#94a3b8", fontSize: 11, margin: "4px 0" }}>
        <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
        or
        <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
      </div>

      <button
        type="button"
        className="btn"
        onClick={() => navigate("/c/build/new")}
        style={{ alignSelf: "flex-start" }}
      >
        + New companion
      </button>
    </div>
  );
}
