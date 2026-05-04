import { useNavigate } from "react-router-dom";
import { buildExamples, type BuildExample } from "../../../companions/build/examples";

interface Props {
  /** Optional heading shown above the chip grid. Pass `null` to omit. */
  heading?: string | null;
}

const SYSTEM_LABELS: Record<string, string> = {
  "github-pr-reviewer": "GitHub API",
  "cloudwatch-investigator": "AWS CloudWatch",
  "linear-groomer": "Linear API",
};

const SHORT_DESCRIPTIONS: Record<string, string> = {
  "github-pr-reviewer": "Flag risky diffs, suggest review questions. Read-only.",
  "cloudwatch-investigator": "Query log groups, suggest root-cause hypotheses. Read-only.",
  "linear-groomer": "Surface stale tickets, suggest priority changes. Read-only.",
};

export default function BuildChips({ heading = "Ideas to start from" }: Props) {
  const navigate = useNavigate();

  const openExample = (ex: BuildExample) => {
    navigate(`/c/build/new?example=${ex.slug}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {heading && <div className="eyebrow">{heading}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {buildExamples.map((ex) => (
          <button
            key={ex.slug}
            type="button"
            data-testid="chip"
            onClick={() => openExample(ex)}
            className="card-bordered"
            style={{
              background: "var(--bg)",
              textAlign: "left",
              cursor: "pointer",
              font: "inherit",
              color: "inherit",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minHeight: 200,
            }}
          >
            <div style={{ fontSize: 26 }} aria-hidden="true">{ex.icon}</div>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.15 }}>{ex.displayName}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, flex: 1 }}>
              {SHORT_DESCRIPTIONS[ex.slug] ?? ex.description}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: 12,
                borderTop: "1px dashed rgba(21, 24, 26, 0.08)",
              }}
            >
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.05em" }}>
                → {SYSTEM_LABELS[ex.slug] ?? ""}
              </span>
              <span className="serif-italic" style={{ fontSize: 18, color: "var(--muted)" }}>→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
