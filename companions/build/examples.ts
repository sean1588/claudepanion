export interface BuildExample {
  slug: string;
  kind: "entity" | "tool";
  displayName: string;
  icon: string;
  description: string;
}

export const buildExamples: BuildExample[] = [
  {
    slug: "pr-reviewer",
    kind: "entity",
    displayName: "PR reviewer",
    icon: "🔎",
    description: "Review a PR in this repo, flag risky diffs, and suggest questions to ask the author.",
  },
  {
    slug: "release-notes-drafter",
    kind: "entity",
    displayName: "Release notes drafter",
    icon: "📝",
    description: "Generate user-facing release notes from merged PRs in a git range.",
  },
  {
    slug: "codebase-onboarding-doc",
    kind: "entity",
    displayName: "Codebase onboarding doc",
    icon: "🧭",
    description: 'Read this repo and write a "how to get oriented" doc for new contributors.',
  },
  {
    slug: "design-doc-reviewer",
    kind: "entity",
    displayName: "Design doc reviewer",
    icon: "🪓",
    description: "Critique a pasted design doc: flag ambiguities, missing constraints, unstated assumptions.",
  },
  {
    slug: "postmortem-writer",
    kind: "entity",
    displayName: "Postmortem writer",
    icon: "🕯️",
    description: "Turn a pasted incident timeline into a structured postmortem: impact, root cause, action items.",
  },
];
