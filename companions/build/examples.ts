export interface BuildFormField {
  name: string;
  required: boolean;
  description: string;
}

export interface BuildToolSpec {
  /** Tool name, snake_case (e.g. `fetch_url`). */
  name: string;
  /** What the tool does + when to use it. */
  description: string;
  /** Free-text description of arguments (name, type, required/optional, default). */
  args: string;
}

interface BuildExampleBase {
  slug: string;
  displayName: string;
  icon: string;
  /** Short subtitle shown on the chip card and as a tooltip. */
  description: string;
  /** What the companion is for / what it produces. */
  goal: string;
  /** Read-only / auth / defaults / anything Build should know. */
  behavior: string;
}

export interface BuildUiExample extends BuildExampleBase {
  kind: "ui";
  /** Structured form fields the scaffolded companion should expose. */
  formFields: BuildFormField[];
  /** Free-form markdown sketch of the artifact's sections/shape. */
  artifactTemplate: string;
}

export interface BuildToolExample extends BuildExampleBase {
  kind: "tool";
  /** MCP tools the scaffolded companion should expose. */
  tools: BuildToolSpec[];
}

export type BuildExample = BuildUiExample | BuildToolExample;

// Chips prefill the structured Build form. Each one names a distinct external
// system, captures WHERE/WHICH (not "paste your text here"), and defaults to
// read-only. Chips do NOT drive any per-companion skill-template branching —
// Build authors the skill body from scratch every time per scaffold-spec §16d.
export const buildExamples: BuildExample[] = [
  {
    slug: "github-pr-reviewer",
    kind: "ui",
    displayName: "GitHub PR reviewer",
    icon: "🔎",
    description:
      "Review a GitHub pull request: fetch the PR metadata, the unified diff, and existing review comments. Flag risky diffs (auth changes, swallowed errors, missing tests) and suggest review questions for the author. Read-only — do not post anything back to GitHub.",
    goal: `Review a GitHub pull request: fetch the diff, existing review comments, and PR metadata, then produce a structured code-review report.`,
    formFields: [
      { name: "Repo", required: true, description: "owner/name format, e.g. sean1588/claudepanion" },
      { name: "PR number", required: true, description: "integer" },
      { name: "Review focus", required: false, description: "free-text bias like \"security\" or \"performance\" to weight the analysis" },
    ],
    artifactTemplate: `1. **Verdict** — 1-2 sentence overall take (e.g. "Solid refactor with two blocking concerns" or "Ship it").
2. **Risks** — bullet list of anything that could break in production (auth, data loss, concurrency, missing tests, swallowed errors). Each risk cites file:line.
3. **Address before merge** — actionable items, grouped by severity:
   - **Major** — must fix before merge (correctness bugs, security, breaking changes)
   - **Minor** — should fix but not blocking (clarity, naming, missing edge case)
   - **Nits** — optional polish (typos, style preferences)
   Each item cites file:line and names what to change.
4. **Questions for the author** — clarifying questions where intent is unclear.`,
    behavior: `Read-only — do not post comments back to GitHub. Uses a GitHub token from the local environment (e.g. \`gh auth token\` or GITHUB_TOKEN).`,
  },
  {
    slug: "cloudwatch-investigator",
    kind: "ui",
    displayName: "CloudWatch investigator",
    icon: "📊",
    description:
      "Investigate AWS CloudWatch logs over a time window — either driven by a triggered alarm or as a general log dive. Uses local AWS credentials (~/.aws/credentials profile). Read-only.",
    goal: `Investigate AWS CloudWatch logs to diagnose an issue. The use case is intentionally broader than just alarms — it should work equally well for "this alarm tripped, why?" and for "I think something's wrong, let me dig into the logs." Query the relevant log groups over the given time window, find error patterns, correlate with alarm transitions (if an alarm was provided), and produce a structured investigation report.`,
    formFields: [
      { name: "AWS profile", required: true, description: "name from ~/.aws/credentials, e.g. \"default\" or \"prod-readonly\". A plain dropdown listing profiles detected in the user's local credentials file is ideal; fall back to a text input if profile enumeration isn't trivial." },
      { name: "Region", required: true, description: "**searchable dropdown prepopulated with the full list of AWS public regions** (us-east-1, us-east-2, us-west-1, us-west-2, eu-west-1, eu-west-2, eu-central-1, ap-northeast-1, ap-southeast-1, ap-southeast-2, sa-east-1, etc. — there are roughly 30, hardcode them since the list changes rarely). Default to the profile's configured region if available." },
      { name: "Log groups", required: true, description: "**searchable multi-select dropdown that lazily loads ALL CloudWatch log groups in the selected region from AWS** when the user opens it (calls DescribeLogGroups; paginates if needed). The user can pick one or more. This list depends on Region — when the Region changes, the cached list must be invalidated and re-fetched on next open. If Region isn't selected yet, the dropdown should be disabled with a \"Select a region first\" hint." },
      { name: "Time window start", required: true, description: "ISO-8601 timestamp, e.g. 2026-05-22T03:00:00Z. Default to \"1 hour before now\" on form open." },
      { name: "Time window end", required: true, description: "ISO-8601 timestamp. Default to \"now.\"" },
      { name: "Alarm name", required: false, description: "exact CloudWatch alarm name when the investigation is alarm-driven; leave blank for a general log dive. When provided, the investigation should include alarm state transitions in the timeline section." },
      { name: "Filter pattern", required: false, description: "CloudWatch Logs Insights filter string for power users (e.g. `fields @timestamp, @message | filter @message like /ERROR/`). If absent, default to a broad error-pattern scan across the selected log groups." },
    ],
    artifactTemplate: `1. **Headline finding** — 1-2 sentence top-level conclusion, with a confidence tag (**High** / **Medium** / **Low**) and the evidence that drove it.
2. **Error patterns observed** — bullet list of distinct error signatures in the logs. For each: pattern, occurrence count, first-seen / last-seen timestamps, a representative log line, and (where context allows) the likely subsystem.
3. **Timeline** — chronological bullet list of key events in the window: deploys, error spikes, latency shifts, and alarm state transitions if an alarm was provided. Each entry has a timestamp.
4. **Recommended next checks** — grouped by priority:
   - **Major** — checks that would confirm or refute the top hypothesis (specific metrics to query, dashboards to open, code paths to inspect, queries to re-run with broader filters)
   - **Minor** — supporting investigations worth doing if the major checks come back inconclusive
5. **Related signals worth watching** — bullets covering related alarms, metrics, or log groups that may be relevant. Link to the CloudWatch resource where possible.`,
    behavior: `Uses local AWS credentials from ~/.aws/credentials. Read-only — do not modify alarms, logs, dashboards, or any AWS resources.

Notes for Build:
- The Region list is essentially static — hardcode it as a constant rather than calling AWS.
- The Log groups dropdown requires a server-side MCP/proxy tool that calls AWS DescribeLogGroups for the selected region. Use the framework's optionsFrom mechanism if it supports dependent fields; otherwise the form needs custom logic for the region → log-groups dependency.
- The framework's default schema-driven form currently supports ui.kind "select" (not "searchableSelect"). To get the searchable affordance on Region and Log groups, ship a custom form.tsx override that wraps the select with a search input — that's the existing escape hatch for richer form UI.`,
  },
  {
    slug: "linear-groomer",
    kind: "ui",
    displayName: "Linear backlog groomer",
    icon: "📋",
    description:
      "Triage Linear issues for a team: list stale tickets (untouched for over 30 days), summarize each one, and suggest priority changes. Read-only — do not update issues.",
    goal: `Triage a Linear team's backlog: pull the open issues, identify stale or misprioritized tickets, and produce a structured grooming report the team can work through synchronously.`,
    formFields: [
      { name: "Linear API key", required: true, description: "personal API key from Linear settings" },
      { name: "Team key", required: true, description: "short team identifier, e.g. \"ENG\" or \"DESIGN\"" },
      { name: "Staleness threshold in days", required: false, description: "how old \"stale\" means (default 30)" },
      { name: "Label filter", required: false, description: "only consider tickets with this label, e.g. \"bug\" or \"tech-debt\"" },
      { name: "Max tickets to review", required: false, description: "cap for very large backlogs (default 50)" },
    ],
    artifactTemplate: `1. **Backlog health summary** — 2-3 sentences on the overall shape (total open, % stale, oldest untouched ticket, biggest category of staleness).
2. **Tickets by recommended action** — grouped buckets, each with the ticket title, identifier (e.g. ENG-1234), age since last update, and a one-sentence justification:
   - **Archive** — should be closed without action (obsolete, duplicate, won't-do)
   - **Reprioritize** — priority no longer matches reality (escalate or de-escalate)
   - **Needs grooming** — has insufficient detail to estimate or assign; requires owner follow-up
   - **Keep as-is** — valid and well-scoped but happens to be old; no action required
3. **Suggested follow-ups for the team** — bullet list of cross-cutting observations (e.g. "5 tickets all mention the same flaky test — worth a dedicated chunk of time").`,
    behavior: `Read-only — do not modify any issues, statuses, or priorities.`,
  },
];

export type BuildPromptParts =
  | {
      kind: "ui";
      goal: string;
      formFields: BuildFormField[];
      artifactTemplate: string;
      behavior: string;
    }
  | {
      kind: "tool";
      goal: string;
      tools: BuildToolSpec[];
      behavior: string;
    };

/**
 * Produces a Build-friendly description string from the structured form parts.
 * Mirrors the shape of the original hand-authored chip prompts so the build
 * skill doesn't need to know the form is now structured.
 */
export function serializeBuildPrompt(parts: BuildPromptParts): string {
  const sections: string[] = [];

  const goal = parts.goal.trim();
  if (goal) sections.push(goal);

  if (parts.kind === "ui") {
    const tpl = parts.artifactTemplate.trim();
    if (tpl) {
      sections.push(`The artifact follows a fixed template the companion must fill in:\n\n${tpl}`);
    }
    const fields = parts.formFields.filter((f) => f.name.trim().length > 0);
    if (fields.length > 0) {
      const lines = fields.map((f) => {
        const tag = f.required ? "required" : "optional";
        const desc = f.description.trim();
        return desc ? `- **${f.name.trim()}** (${tag}) — ${desc}` : `- **${f.name.trim()}** (${tag})`;
      });
      sections.push(`Form fields:\n${lines.join("\n")}`);
    }
  } else {
    const tools = parts.tools.filter((t) => t.name.trim().length > 0);
    if (tools.length > 0) {
      const blocks = tools.map((t) => {
        const lines: string[] = [`- **${t.name.trim()}** — ${t.description.trim() || "(no description)"}`];
        const args = t.args.trim();
        if (args) {
          const indented = args.split("\n").map((l) => `  ${l}`).join("\n");
          lines.push(`  Args:\n${indented}`);
        }
        return lines.join("\n");
      });
      sections.push(`Tools to expose:\n${blocks.join("\n")}`);
    }
  }

  const behavior = parts.behavior.trim();
  if (behavior) sections.push(`Behavior & constraints:\n${behavior}`);

  return sections.join("\n\n");
}
