import type { Manifest } from "../../src/shared/types.js";

export const manifest: Manifest = {
  name: "github-pr-reviewer",
  kind: "entity",
  displayName: "Github Pr Reviewer",
  icon: "🔍",
  description: "Fetch a GitHub PR's metadata, diff, and review comments; flag risky patterns and suggest review questions. Read-only.",
  contractVersion: "1",
  version: "0.1.0",
  requiredEnv: ["GITHUB_TOKEN"],
  actionLabels: {
    newEntity: "Review a PR",
    listEntities: "View reviews",
  },
};
