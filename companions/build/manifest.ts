import type { Manifest } from "../../src/shared/types.js";

export const manifest: Manifest = {
  name: "build",
  kind: "ui",
  displayName: "Build",
  icon: "🔨",
  description: "Build new companions and iterate on existing ones.",
  contractVersion: "2",
  version: "0.3.0",
  actionLabels: {
    newEntity: "Build new companion",
    listEntities: "View builds",
  },
};
