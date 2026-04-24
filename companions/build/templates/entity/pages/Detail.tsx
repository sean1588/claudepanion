import type { Entity } from "../../../src/shared/types";
import type { __CAMEL__Input, __CAMEL__Artifact } from "../types";

export default function __CAMEL__Detail({ entity }: { entity: Entity<__CAMEL__Input, __CAMEL__Artifact> }) {
  if (!entity.artifact) return null;
  return (
    <div>
      <p style={{ fontSize: 14, margin: 0 }}>{entity.artifact.summary}</p>
    </div>
  );
}
