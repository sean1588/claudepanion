import type { Entity } from "../../../src/shared/types";
import type { BuildInput, BuildArtifact } from "../types";

export default function BuildDetail({ entity }: { entity: Entity<BuildInput, BuildArtifact> }) {
  const a = entity.artifact;
  if (!a) return null;
  const check = (pass: boolean) => (
    <span style={{ color: pass ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
      {pass ? "✓" : "✗"}
    </span>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div>
          {check(a.validatorPassed)} <span style={{ fontSize: 13 }}>validator</span>
        </div>
        <div>
          {check(a.smokeTestPassed)} <span style={{ fontSize: 13 }}>smoke test</span>
        </div>
      </div>
      {a.summary && <p style={{ fontSize: 14, margin: 0 }}>{a.summary}</p>}
      {a.filesCreated.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Files created</div>
          <ul style={{ margin: 0, paddingLeft: 20, fontFamily: "monospace", fontSize: 12 }}>
            {a.filesCreated.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}
      {a.filesModified.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Files modified</div>
          <ul style={{ margin: 0, paddingLeft: 20, fontFamily: "monospace", fontSize: 12 }}>
            {a.filesModified.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
