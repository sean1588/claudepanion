# Example Chip Requirements

Requirements every Build companion chip example must satisfy, plus evaluation of current candidates.

---

## The canonical interaction pattern

Every chip example must trace this full path end-to-end. If any box is missing or collapsed into a no-op, the example doesn't demonstrate the framework.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. FORM                                                                    │
│                                                                             │
│  User fills companion form. Fields capture WHERE/WHICH — configuration     │
│  that makes a general query specific to this run. Not "paste text here."   │
│                                                                             │
│  e.g. "which GitHub repo + PR number + review focus"                       │
│       "which AWS profile + log group + alarm name + time range"            │
│       "which Linear team + label filter + staleness threshold"             │
└──────────────────────┬──────────────────────────────────────────────────────┘
                       │ POST /api/entities
                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. ENTITY CREATED (pending)                                                │
│                                                                             │
│  Server writes data/<companion>/<id>.json  status: "pending"               │
│  Detail page renders slash command: /my-companion <id>                     │
│  UI begins polling GET /api/entities/:id every 2s                          │
└──────────────────────┬──────────────────────────────────────────────────────┘
                       │ user pastes into Claude Code
                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. CLAUDE CODE HANDOFF                                                     │
│                                                                             │
│  Claude matches slash command → loads skills/<name>-companion/SKILL.md     │
│  Skill is the program. Every step specifies which MCP tool to call.        │
└──────────────────────┬──────────────────────────────────────────────────────┘
                       │ MCP tool calls via http://localhost:3001/mcp
                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. GENERIC ENTITY TOOLS  (state management — auto-registered)             │
│                                                                             │
│  <name>_get          → read entity, return input fields to Claude          │
│  <name>_update_status → write status + statusMessage → UI pill updates     │
│  <name>_append_log   → write log line → UI log tail updates every 2s      │
│  <name>_save_artifact → write artifact → UI morphs to completed view      │
│  <name>_fail         → write error state → UI shows error                 │
└──────────────────────┬──────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. DOMAIN-SPECIFIC MCP PROXY TOOLS  ◄─── THIS IS THE WHOLE POINT         │
│                                                                             │
│  Defined in companions/<name>/server/tools.ts                              │
│  Claude calls these; the SERVER makes authenticated API calls.             │
│  Claude cannot reach these systems any other way.                          │
│                                                                             │
│  e.g.  github_get_pr_diff({ repo, pr_number })                             │
│           └─► GitHub API (uses local OAuth token)                          │
│                                                                             │
│        query_logs({ profile, logGroup, startTime, endTime, filter })      │
│           └─► AWS CloudWatch FilterLogEvents (uses ~/.aws/credentials)    │
│                                                                             │
│        linear_list_issues({ teamId, label, updatedBefore })               │
│           └─► Linear API (uses local API key)                             │
│                                                                             │
│  Results come back to Claude as MCP text content.                          │
│  Each call also appends a log line → UI updates live.                      │
└──────────────────────┬──────────────────────────────────────────────────────┘
                       │ save_artifact + update_status("completed")
                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  6. ARTIFACT                                                                │
│                                                                             │
│  The output of real queries. Durable JSON, not a re-derivable summary.     │
│  Rendered in the UI by a custom Detail page component.                     │
│  Can be referenced again via "Continue" — same entity, new run context.    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Non-negotiable requirements

A chip example must satisfy all six. Failing any one disqualifies it.

- [ ] **Has domain-specific proxy tools.** `companions/<name>/server/tools.ts` contains tools beyond the six generic entity tools. These are hand-written, domain-specific, and make real external API calls.

- [ ] **Tools call an external system.** Each proxy tool uses a real SDK or API client — AWS SDK, GitHub API, Linear API, Slack API, etc. The server is the authenticated intermediary. Credentials live on the user's machine, not in Claude's context.

- [ ] **Claude cannot do this without the companion.** If the same result is achievable by pasting text into a Claude chat session and asking Claude to analyze it, the companion adds nothing.

- [ ] **Form captures configuration, not content.** Fields specify WHERE to query — which account, which repo, which team, which time range. Not "paste the thing you want Claude to analyze here."

- [ ] **Artifact comes from real data.** The saved artifact is the product of live API calls, not a summary of user-provided text. It is durable, shareable, and repeatable.

- [ ] **Run is repeatable.** The same form configuration can be submitted again to produce a fresh run against live data. Each run may produce a different artifact as the underlying system changes.

---

## The disqualifier test

> **"Can the user get the same result by pasting text into a plain Claude chat session?"**

If yes: don't build it as a companion. That's a chat conversation.

---

## Current chip examples — evaluated

| Example | Proxy tools? | External API? | Form captures config? | Disqualifier test |
|---|---|---|---|---|
| PR reviewer | ❌ uses git diff via Claude's built-in tools | ❌ | ❌ "which PR" via URL paste | **FAILS** — paste diff into chat |
| Release notes drafter | ❌ uses `git log` via built-in tools | ❌ | ❌ "which range" via text field | **FAILS** — paste git log into chat |
| Codebase onboarding doc | ❌ reads files via built-in tools | ❌ | ❌ no meaningful config | **FAILS** — open repo and ask Claude |
| Design doc reviewer | ❌ analyzes pasted text | ❌ | ❌ literally a paste field | **FAILS** — pure chat |
| Postmortem writer | ❌ analyzes pasted text | ❌ | ❌ literally a paste field | **FAILS** — pure chat |

**All five fail.** None have proxy tools. None require an external API. All are plain chat conversations dressed up as companions.

---

## The Build companion — special case

Build passes on lifecycle but is exempt from the proxy tools requirement for a different reason: its domain *is* file scaffolding, which is inherently accomplished via Claude's native Write/Edit tools. Its value is the self-replicating primitive — the marginal cost of a new companion is "fill a form and paste one command." That's real.

Build does **not** demonstrate MCP proxy access to external systems. It needs a companion alongside it in the examples that does.

---

## Passing example sketches

Each satisfies all six requirements. Listed with their proxy tools and credential source.

| Companion | Proxy tools (in server/tools.ts) | Credential | What Claude can do that it otherwise couldn't |
|---|---|---|---|
| `cloudwatch-investigator` | `query_logs`, `get_alarms`, `get_log_groups` | `~/.aws/credentials` profile | Query real CloudWatch logs and alarms without credential pasting |
| `github-pr-reviewer` | `github_get_pr`, `github_get_diff`, `github_get_comments`, `github_post_review` | local OAuth token | Read real PR diffs, post structured review comments back |
| `linear-groomer` | `linear_list_issues`, `linear_update_issue`, `linear_add_comment` | Linear API key | Read and triage real Linear issues |
| `slack-summarizer` | `slack_get_channel_history`, `slack_get_users`, `slack_post_message` | Slack bot token | Read real channel history, post summaries back |
| `aws-cost-reporter` | `get_cost_and_usage`, `list_cost_anomaly_detections`, `describe_budgets` | `~/.aws/credentials` profile | Query real AWS Cost Explorer data |

Each form captures WHERE: which repo/PR, which team/board, which channel, which AWS account. Not "paste your content here."
