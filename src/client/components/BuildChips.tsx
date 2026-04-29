import { useNavigate } from "react-router-dom";
import { buildExamples, type BuildExample } from "../../../companions/build/examples";

interface Props {
  /** Optional heading shown above the chip grid. Pass `null` to omit. */
  heading?: string | null;
}

export default function BuildChips({ heading = "Ideas to start from" }: Props) {
  const navigate = useNavigate();

  const openExample = (ex: BuildExample) => {
    navigate(`/c/build/new?example=${ex.slug}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {heading && (
        <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
          {heading}
        </div>
      )}

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
    </div>
  );
}
