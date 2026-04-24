import type { Entity } from "../../../src/shared/types";
import type { GroundingInput, GroundingArtifact } from "../types";

export default function GroundingListRow({ entity }: { entity: Entity<GroundingInput, GroundingArtifact> }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
      <span style={{ fontWeight: 500 }}>
        {entity.input.focus?.trim() || "Full overview"}
      </span>
    </div>
  );
}
