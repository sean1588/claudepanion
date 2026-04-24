import ReactMarkdown from "react-markdown";
import type { Entity } from "../../../src/shared/types";
import type { GroundingInput, GroundingArtifact } from "../types";

export default function GroundingDetail({ entity }: { entity: Entity<GroundingInput, GroundingArtifact> }) {
  if (!entity.artifact) return null;
  return (
    <div style={{ fontSize: 14, lineHeight: 1.6 }}>
      <ReactMarkdown>{entity.artifact.briefing}</ReactMarkdown>
    </div>
  );
}
