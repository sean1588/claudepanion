import type { Entity } from "../../../src/shared/types";
import type { GithubPrReviewerInput, GithubPrReviewerArtifact } from "../types";

export default function GithubPrReviewerListRow({
  entity,
}: {
  entity: Entity<GithubPrReviewerInput, GithubPrReviewerArtifact>;
}) {
  const { repo, prNumber } = entity.input;
  const a = entity.artifact;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
      <span style={{ fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap", color: "#64748b" }}>
        {repo}#{prNumber}
      </span>
      {a ? (
        <>
          <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {a.prTitle}
          </span>
          {a.risks.length > 0 && (
            <span
              style={{
                background: "#fef2f2",
                color: "#b91c1c",
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 11,
                whiteSpace: "nowrap",
              }}
            >
              {a.risks.length} risk{a.risks.length > 1 ? "s" : ""}
            </span>
          )}
        </>
      ) : (
        <span style={{ color: "var(--muted)", fontSize: 13 }}>pending…</span>
      )}
    </div>
  );
}
