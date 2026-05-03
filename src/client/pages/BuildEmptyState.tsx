import { useNavigate } from "react-router-dom";
import BuildChips from "../components/BuildChips";

export default function BuildEmptyState() {
  const navigate = useNavigate();

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
          I build new companions from a plain-English description. Everything else you add to the sidebar came from me. Try one of the ideas below, or describe your own.
        </p>
      </div>

      <BuildChips />

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
