import type { Entity } from "../../../src/shared/types";
import type { prReviewerInput, prReviewerArtifact } from "../types";

export default function prReviewerDetail({ entity }: { entity: Entity<prReviewerInput, prReviewerArtifact> }) {
  if (!entity.artifact) return null;
  return (
    <div>
      <p style={{ fontSize: 14, margin: 0 }}>{entity.artifact.summary}</p>
    </div>
  );
}
