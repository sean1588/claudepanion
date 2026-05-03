export interface BuildExample {
  slug: string;
  kind: "entity" | "tool";
  displayName: string;
  icon: string;
  description: string;
}

// Chips are form-text-prefill sugar only. Each chip below is a description known
// to produce a working companion when Build runs it (see scaffold-spec §16h
// and the dogfood runs in PR #13). Each one names a distinct external system,
// captures WHERE/WHICH (not "paste your text here"), and defaults to read-only.
//
// Chips do NOT drive any per-companion skill-template branching — Build authors
// the skill body from scratch every time per §16d.
export const buildExamples: BuildExample[] = [
  {
    slug: "github-pr-reviewer",
    kind: "entity",
    displayName: "GitHub PR reviewer",
    icon: "🔎",
    description:
      "Review a GitHub pull request: fetch the PR metadata, the unified diff, and existing review comments. Flag risky diffs (auth changes, swallowed errors, missing tests) and suggest review questions for the author. Read-only — do not post anything back to GitHub.",
  },
  {
    slug: "cloudwatch-investigator",
    kind: "entity",
    displayName: "CloudWatch investigator",
    icon: "📊",
    description:
      "Investigate AWS CloudWatch logs for an alarm in a given time range. Query the relevant log groups, identify error patterns, and suggest root-cause hypotheses. Uses local AWS credentials (~/.aws/credentials profile). Read-only.",
  },
  {
    slug: "linear-groomer",
    kind: "entity",
    displayName: "Linear backlog groomer",
    icon: "📋",
    description:
      "Triage Linear issues for a team: list stale tickets (untouched for over 30 days), summarize each one, and suggest priority changes. Read-only — do not update issues.",
  },
];
