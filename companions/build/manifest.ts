import type { Manifest } from "../../src/shared/types.js";

export const manifest: Manifest = {
  name: "build",
  kind: "entity",
  displayName: "Build",
  icon: "🔨",
  description: "Build new companions and iterate on existing ones.",
  contractVersion: "1",
  version: "0.1.0",
  actionLabels: {
    newEntity: "Build new companion",
    listEntities: "View builds",
  },
};
