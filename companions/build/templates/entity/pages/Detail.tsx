import type { Entity } from "../../../src/shared/types";
import type { __PASCAL__Input, __PASCAL__Artifact } from "../types";

// TODO(build): replace this placeholder with real artifact rendering per
// scaffold-spec §16d (pages/Detail.tsx). The host wraps this in <BaseArtifactPanel>
// automatically (renders summary + errors[]) — only render the domain middle here.

export default function __PASCAL__Detail({ entity }: { entity: Entity<__PASCAL__Input, __PASCAL__Artifact> }) {
  if (!entity.artifact) return null;
  return (
    <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
      TODO(build): render artifact fields for {entity.id}
    </p>
  );
}
