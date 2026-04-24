import type { Entity } from "../../../src/shared/types";
import type { prReviewerInput, prReviewerArtifact } from "../types";

export default function prReviewerListRow({ entity }: { entity: Entity<prReviewerInput, prReviewerArtifact> }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
      <span style={{ fontWeight: 500 }}>{entity.input.description}</span>
    </div>
  );
}
