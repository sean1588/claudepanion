import type { Entity } from "../../../src/shared/types";
import type { __PASCAL__Input, __PASCAL__Artifact } from "../types";

// TODO(build): replace this placeholder row with real per-row rendering per
// scaffold-spec §16d (pages/List.tsx). Render meaningful summary fields from
// entity.input + entity.artifact — not just a placeholder.

export default function __PASCAL__ListRow({ entity }: { entity: Entity<__PASCAL__Input, __PASCAL__Artifact> }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0, color: "var(--muted)", fontSize: 13 }}>
      <span>TODO(build): render row for {entity.id}</span>
    </div>
  );
}
