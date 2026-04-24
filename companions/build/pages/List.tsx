import type { Entity } from "../../../src/shared/types";
import type { BuildInput, BuildArtifact } from "../types";

export default function BuildListRow({ entity }: { entity: Entity<BuildInput, BuildArtifact> }) {
  const input = entity.input;
  const isNew = input.mode === "new-companion";
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
      <span
        style={{
          background: isNew ? "#ede9fe" : "#dbeafe",
          color: isNew ? "#6d28d9" : "#1e40af",
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 11,
          whiteSpace: "nowrap",
        }}
      >
        {isNew ? "✨ new" : "⟳ iterate"}
      </span>
      <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>
        {input.mode === "new-companion" ? input.name : input.target}
      </span>
      <span style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {input.description}
      </span>
    </div>
  );
}
