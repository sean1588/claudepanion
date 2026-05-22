export interface BuildExample {
  slug: string;
  kind: "ui" | "tool";
  displayName: string;
  icon: string;
  /** Short subtitle shown on the chip card and as a tooltip. */
  description: string;
  /**
   * Rich, structured template that prefills the Build form's textarea when
   * the user clicks the chip. Includes the artifact shape and form fields
   * Build should scaffold — gives Build enough to one-shot a useful companion
   * instead of iterating on missing detail. Falls back to `description` if
   * absent.
   */
  prompt?: string;
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
    kind: "ui",
    displayName: "GitHub PR reviewer",
    icon: "🔎",
    description:
      "Review a GitHub pull request: fetch the PR metadata, the unified diff, and existing review comments. Flag risky diffs (auth changes, swallowed errors, missing tests) and suggest review questions for the author. Read-only — do not post anything back to GitHub.",
    prompt: `Review a GitHub pull request: fetch the diff, existing review comments, and PR metadata, then produce a structured code-review report. Read-only — do not post comments back to GitHub.

The artifact follows a fixed template the reviewer must fill in:

1. **Verdict** — 1-2 sentence overall take (e.g. "Solid refactor with two blocking concerns" or "Ship it").
2. **Risks** — bullet list of anything that could break in production (auth, data loss, concurrency, missing tests, swallowed errors). Each risk cites file:line.
3. **Address before merge** — actionable items, grouped by severity:
   - **Major** — must fix before merge (correctness bugs, security, breaking changes)
   - **Minor** — should fix but not blocking (clarity, naming, missing edge case)
   - **Nits** — optional polish (typos, style preferences)
   Each item cites file:line and names what to change.
4. **Questions for the author** — clarifying questions where intent is unclear.

Form fields:
- Repo (required) — owner/name format, e.g. sean1588/claudepanion
- PR number (required) — integer
- Review focus (optional) — free-text bias like "security" or "performance" to weight the analysis`,
  },
  {
    slug: "cloudwatch-investigator",
    kind: "ui",
    displayName: "CloudWatch investigator",
    icon: "📊",
    description:
      "Investigate AWS CloudWatch logs over a time window — either driven by a triggered alarm or as a general log dive. Uses local AWS credentials (~/.aws/credentials profile). Read-only.",
    prompt: `Investigate AWS CloudWatch logs to diagnose an issue. The use case is intentionally broader than just alarms — it should work equally well for "this alarm tripped, why?" and for "I think something's wrong, let me dig into the logs." Query the relevant log groups over the given time window, find error patterns, correlate with alarm transitions (if an alarm was provided), and produce a structured investigation report. Uses local AWS credentials from ~/.aws/credentials. Read-only — do not modify alarms, logs, dashboards, or any AWS resources.

The artifact follows a fixed template the investigator must fill in:

1. **Headline finding** — 1-2 sentence top-level conclusion, with a confidence tag (**High** / **Medium** / **Low**) and the evidence that drove it.
2. **Error patterns observed** — bullet list of distinct error signatures in the logs. For each: pattern, occurrence count, first-seen / last-seen timestamps, a representative log line, and (where context allows) the likely subsystem.
3. **Timeline** — chronological bullet list of key events in the window: deploys, error spikes, latency shifts, and alarm state transitions if an alarm was provided. Each entry has a timestamp.
4. **Recommended next checks** — grouped by priority:
   - **Major** — checks that would confirm or refute the top hypothesis (specific metrics to query, dashboards to open, code paths to inspect, queries to re-run with broader filters)
   - **Minor** — supporting investigations worth doing if the major checks come back inconclusive
5. **Related signals worth watching** — bullets covering related alarms, metrics, or log groups that may be relevant. Link to the CloudWatch resource where possible.

Form fields:
- **AWS profile** (required) — name from ~/.aws/credentials, e.g. "default" or "prod-readonly". A plain dropdown listing profiles detected in the user's local credentials file is ideal; fall back to a text input if profile enumeration isn't trivial.
- **Region** (required) — **searchable dropdown prepopulated with the full list of AWS public regions** (us-east-1, us-east-2, us-west-1, us-west-2, eu-west-1, eu-west-2, eu-central-1, ap-northeast-1, ap-southeast-1, ap-southeast-2, sa-east-1, etc. — there are roughly 30, hardcode them since the list changes rarely). Default to the profile's configured region if available.
- **Log groups** (required) — **searchable multi-select dropdown that lazily loads ALL CloudWatch log groups in the selected region from AWS** when the user opens it (calls DescribeLogGroups; paginates if needed). The user can pick one or more. This list depends on Region — when the Region changes, the cached list must be invalidated and re-fetched on next open. If Region isn't selected yet, the dropdown should be disabled with a "Select a region first" hint.
- **Time window start** (required) — ISO-8601 timestamp, e.g. 2026-05-22T03:00:00Z. Default to "1 hour before now" on form open.
- **Time window end** (required) — ISO-8601 timestamp. Default to "now."
- **Alarm name** (optional) — exact CloudWatch alarm name when the investigation is alarm-driven; leave blank for a general log dive. When provided, the investigation should include alarm state transitions in the timeline section.
- **Filter pattern** (optional) — CloudWatch Logs Insights filter string for power users (e.g. \`fields @timestamp, @message | filter @message like /ERROR/\`). If absent, default to a broad error-pattern scan across the selected log groups.

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
    prompt: `Triage a Linear team's backlog: pull the open issues, identify stale or misprioritized tickets, and produce a structured grooming report the team can work through synchronously. Read-only — do not modify any issues, statuses, or priorities.

The artifact follows a fixed template the groomer must fill in:

1. **Backlog health summary** — 2-3 sentences on the overall shape (total open, % stale, oldest untouched ticket, biggest category of staleness).
2. **Tickets by recommended action** — grouped buckets, each with the ticket title, identifier (e.g. ENG-1234), age since last update, and a one-sentence justification:
   - **Archive** — should be closed without action (obsolete, duplicate, won't-do)
   - **Reprioritize** — priority no longer matches reality (escalate or de-escalate)
   - **Needs grooming** — has insufficient detail to estimate or assign; requires owner follow-up
   - **Keep as-is** — valid and well-scoped but happens to be old; no action required
3. **Suggested follow-ups for the team** — bullet list of cross-cutting observations (e.g. "5 tickets all mention the same flaky test — worth a dedicated chunk of time").

Form fields:
- Linear API key (required) — personal API key from Linear settings
- Team key (required) — short team identifier, e.g. "ENG" or "DESIGN"
- Staleness threshold in days (optional, default 30) — how old "stale" means
- Label filter (optional) — only consider tickets with this label, e.g. "bug" or "tech-debt"
- Max tickets to review (optional, default 50) — cap for very large backlogs`,
  },
];
