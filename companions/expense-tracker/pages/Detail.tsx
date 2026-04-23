import type { Entity } from "../../../src/shared/types";
import type { ExpenseInput, ExpenseArtifact } from "../types";

export default function ExpenseArtifactBody({ entity }: { entity: Entity<ExpenseInput, ExpenseArtifact> }) {
  const a = entity.artifact;
  if (!a) return null;
  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{entity.input.description}</div>
        <div style={{ color: "var(--muted)", fontSize: 14 }}>${entity.input.amount.toFixed(2)}</div>
        <span style={{ background: "#dbeafe", color: "#1e40af", padding: "4px 12px", borderRadius: 999, fontSize: 12 }}>{a.tag}</span>
      </div>
      <p style={{ margin: 0, color: "#334155", lineHeight: 1.55 }}>{a.summary}</p>
    </div>
  );
}
