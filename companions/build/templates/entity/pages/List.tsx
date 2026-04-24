import type { Entity } from "../../../src/shared/types";
import type { __CAMEL__Input, __CAMEL__Artifact } from "../types";

export default function __CAMEL__ListRow({ entity }: { entity: Entity<__CAMEL__Input, __CAMEL__Artifact> }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
      <span style={{ fontWeight: 500 }}>{entity.input.description}</span>
    </div>
  );
}
