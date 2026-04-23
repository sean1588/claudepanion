import type { Entity } from "../../../src/shared/types";
import type { ExpenseInput, ExpenseArtifact } from "../types";

export default function ExpenseListRow({ entity }: { entity: Entity<ExpenseInput, ExpenseArtifact> }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
      <span style={{ fontWeight: 500 }}>{entity.input.description}</span>
      <span style={{ color: "var(--muted)" }}>${entity.input.amount.toFixed(2)}</span>
      {entity.artifact && (
        <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 999, fontSize: 11 }}>
          {entity.artifact.tag}
        </span>
      )}
    </div>
  );
}
