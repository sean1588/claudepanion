import type { Entity } from "../../../src/shared/types";
import type { __PASCAL__Input, __PASCAL__Artifact } from "../types";

export default function __PASCAL__Detail({ entity }: { entity: Entity<__PASCAL__Input, __PASCAL__Artifact> }) {
  if (!entity.artifact) return null;
  return (
    <div>
      <p style={{ fontSize: 14, margin: 0 }}>{entity.artifact.summary}</p>
    </div>
  );
}
