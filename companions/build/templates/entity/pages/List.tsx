import type { Entity } from "../../../src/shared/types";
import type { __PASCAL__Input, __PASCAL__Artifact } from "../types";

export default function __PASCAL__ListRow({ entity }: { entity: Entity<__PASCAL__Input, __PASCAL__Artifact> }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
      <span style={{ fontWeight: 500 }}>{entity.input.description}</span>
    </div>
  );
}
