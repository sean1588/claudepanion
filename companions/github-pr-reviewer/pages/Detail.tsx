import type { Entity } from "../../../src/shared/types";
import type { GithubPrReviewerInput, GithubPrReviewerArtifact } from "../types";

export default function GithubPrReviewerDetail({
  entity,
}: {
  entity: Entity<GithubPrReviewerInput, GithubPrReviewerArtifact>;
}) {
  const a = entity.artifact;
  if (!a) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "baseline" }}>
        <a href={a.prUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 16 }}>
          {a.prTitle}
        </a>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>
          by {a.prAuthor} · {a.filesChanged} file{a.filesChanged !== 1 ? "s" : ""} changed
        </span>
      </div>

      {a.risks.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Risks flagged
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
            {a.risks.map((r, i) => (
              <li key={i} style={{ color: "#b91c1c", fontSize: 13 }}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {a.reviewQuestions.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Suggested review questions
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
            {a.reviewQuestions.map((q, i) => (
              <li key={i} style={{ fontSize: 13 }}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
