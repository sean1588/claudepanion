import type { Manifest } from "../../src/shared/types.js";

export const manifest: Manifest = {
  name: "pr-reviewer",
  kind: "entity",
  displayName: "PR Reviewer",
  icon: "🔍",
  description: "Review a PR in this repo, flag risky diffs, and suggest questions to ask the author.",
  contractVersion: "1",
  version: "0.1.0",
};
