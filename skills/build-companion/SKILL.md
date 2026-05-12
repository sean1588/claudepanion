---
name: build-companion
description: Use when the user pastes "/build-companion <entity-id>" — scaffolds a new companion or iterates on an existing one for claudepanion.
---

# /build-companion <entity-id>

Build is claudepanion's companion that scaffolds other companions.

> **Where files go.** Companions live at `~/.claudepanion/companions/<slug>/` and skills at `~/.claudepanion/skills/<slug>-companion/`. Below, `companions/<slug>/...` and `skills/<slug>-companion/...` are shorthand for the `~/.claudepanion/`-rooted absolute path. **Always use the absolute path in Write/Edit tool calls** — do NOT author into the framework's checkout (e.g. wherever your Claude Code session was started).

> **CRITICAL — MCP tools ONLY:**
> - All state changes go through `mcp__claudepanion__build_*` tools.
> - NEVER curl `/api/entities/*` to mutate state.
> - NEVER edit `~/.claudepanion/data/build/*.json` directly.
> - NEVER leave a placeholder like `<<<INSERT PLAYBOOK HERE>>>` in an authored file.
> - NEVER mark `completed` until `claudepanion scaffold`'s self-check stage passed.

The reference doc for the contract you're authoring against is [`docs/scaffold-spec.md`](../../docs/scaffold-spec.md).

## Step 0 — Verify the claudepanion MCP is connected

**This MUST be the first thing you do. Do not skip it. Do not improvise around it.**

Confirm `mcp__claudepanion__*` tools are available in this session before doing anything else. If Step 1 below (the `build_get` call) returns "tool not available", "MCP server not connected", a transport error, or any analogous failure:

- **STOP. Do not continue past this step.**
- **Do not** read files manually, run `git` / `grep` / Bash, or try to discover the entity any other way.
- **Do not** start authoring scaffold files speculatively.
- Tell the user the message below and wait for them to fix the connection before proceeding.

> I can't reach the claudepanion MCP server. Try these in order:
>
> 1. Run `/mcp` in this session and check whether `claudepanion` is listed (and not in an error state).
> 2. Confirm the claudepanion server is running — open <http://localhost:3001> or run `lsof -i :3001`. If it isn't, run `claudepanion serve`.
> 3. Re-install the plugin in this repo: `claudepanion plugin install`.
> 4. Rebuild the claudepanion checkout: `npm run build`.
> 5. Start a **new** Claude Code session (plugins load at session start, not mid-session) and re-run `/mcp` to confirm — then re-paste the slash command.
>
> See [`docs/troubleshooting.md`](../../docs/troubleshooting.md) for more.

The MCP server is the only supported channel for this skill. If it's unreachable, the work cannot proceed — there is no manual fallback.

## Step 1 — Load the entity

```
mcp__claudepanion__build_get({ id: "<entity-id>" })
```

Branch on `entity.input.mode`: `"new-companion"` runs Steps 2–10; `"iterate-companion"` jumps to the iterate sub-flow.

### Step 1.5 — Detect continuation

If `entity.artifact !== null`, this is a continuation — the user clicked "Continue" on a prior completed run. The new `description` is a redirection. Read the prior artifact, then *modify* the existing files instead of re-scaffolding.

## Step 2 — Validate + interpret (new mode)

Reject if:
- `name` doesn't match `/^[a-z][a-z0-9-]*$/`
- `~/.claudepanion/companions/<name>/` already exists
- `name === "build"`

Read `entity.input.description` and decide all of:

1. **External system** — AWS, GitHub, Linear, Slack, OpenAI, generic HTTP, or none.
2. **Read-only or has writes** — does the description ask for actions that change external state?
3. **Input schema fields** — what configures each run (the WHERE/WHICH, not "paste your text").
4. **Artifact extras** — typed fields beyond `summary`/`markdown`, only if a list-row override needs them. Otherwise `Artifact = BaseArtifact;`.
5. **Proxy tools** — one per API call, named `<slug_with_underscores>_<verb>`.
6. **SDK + credential helper** — see the table below.

## Step 3 — Echo the interpretation, pause

```
mcp__claudepanion__build_append_log({
  id: "<entity-id>",
  message: "Interpreted as <read-only|with-write> companion against <system>.\n  Form fields: <list>\n  Tools: <list>\n  Artifact extras: <none|list>\n  SDK: <package>; credentials: <env or helper>"
})
```

Pause ~5 seconds so the user can interrupt with `Ctrl-C` if the interpretation is off.

## Step 4 — Mark running

```
mcp__claudepanion__build_update_status({
  id: "<entity-id>",
  status: "running",
  statusMessage: "scaffolding <name> (<read-only|with-write>, <system>, <N> tools)"
})
```

## Step 5 — Author 4 files

Author real domain content for each file based on Step 2's interpretation. No tokens, no `<<<INSERT>>>`, no empty arrays when an external system was named.

| File | Contents |
|---|---|
| `companions/<slug>/manifest.ts` | `name`, `kind: "ui"`, `displayName`, `icon`, `description`, `contractVersion: "2"`, `version: "0.1.0"`, `requiredEnv`. |
| `companions/<slug>/types.ts` | `InputSchema = z.object({...})` with `.describe()` and `.meta({ ui: ... })`. Optional `ArtifactExtras`. Default `Artifact = BaseArtifact;`. |
| `companions/<slug>/server/tools.ts` | One `defineTool({...})` per proxy tool. Inline error classifier mapping the SDK's errors onto `[config]` / `[input]` / `[transient]`. `sideEffect: "write"` on write tools with explicit consequence in the description. |
| `skills/<slug>-companion/SKILL.md` | Frontmatter + CRITICAL block + **Step 0 (verify MCP)** + Steps 1–6. Step 4 is a sequenced playbook of `mcp__claudepanion__<slug>_*` tool calls + log lines — one sub-step per tool. Write tools get the user-permission stanza. |

After each file:
```
mcp__claudepanion__build_append_log({ id, message: "wrote <path>" })
```

## Step 6 — Add SDK to package.json (if needed)

If the chosen SDK isn't already a dependency, add it. The scaffold CLI's `deps` stage runs `npm install` and reports back, so you don't need to run it yourself — just edit `package.json`.

## Step 7 — Run the scaffold CLI

```bash
claudepanion scaffold <slug>
```

This runs in order: `validate` → `deps` → `codegen` (regenerates `companions/<slug>/index.ts`, `companions/index.ts`, `companions/client.ts`) → `build` (`tsc` + `vite build`) → `remount` (POST `/api/internal/remount`) → `self-check` (validator + smoke).

It emits one JSON object on stdout. On success: `{ ok: true, stagesRun, filesGenerated, dependenciesAdded, selfCheck }`. On failure: `{ ok: false, stage, error, remediation }`.

## Step 8 — Branch on scaffold result

| Stage | Remediation |
|---|---|
| `validate` | manifest mismatch / missing file. Fix the named file; re-run. |
| `deps` | npm install failed. Check package name + network. |
| `codegen` | filesystem error. Check permissions. |
| `build` | tsc/vite failed. Read the error; fix `types.ts` or `server/tools.ts`. |
| `remount` | server unreachable. Confirm `claudepanion serve` is running. |
| `self-check` | validator or smoke issue. Read the `issues[]`; fix; re-run. |

On any failure call `mcp__claudepanion__build_fail` with `errorMessage: "[<prefix>] <stage>: <error>"`. Do NOT proceed to Step 9.

## Step 9 — Ask the user whether to commit

Show a summary of what was scaffolded (files created, tools, SDK) and ask:

> "Companion `<slug>` scaffolded and self-check passed. Should I commit it to git? (yes / no / skip)"

**Only commit if the user explicitly confirms.** If they say no or skip, proceed directly to Step 10 without running any `git` commands.

If they confirm:

```bash
cd ~/.claudepanion
git rev-parse --git-dir 2>/dev/null && \
  git add companions/<slug> skills/<slug>-companion companions/index.ts companions/client.ts package.json package-lock.json && \
  git commit -m "companion: scaffold <slug>"
```

The `cd ~/.claudepanion` + `git rev-parse` check matters: the user's home is only a git repo if they've opted into the dotfile-style workflow (`git init ~/.claudepanion`). If it's not a git repo, skip the commit and tell the user. **Never commit into the framework's own checkout** — companion files don't live there in the user-local install model.

Drop `package.json`/`package-lock.json` from the `git add` if no SDK was added.

## Step 10 — Save artifact + complete

The artifact is markdown — what was built, where it lives, what to do next. A good shape:

```markdown
## Built `<slug>`

<one-paragraph description of the companion: external system, read/write, credential model>

**Tools:** `<tool_1>`, `<tool_2>`, …

### Files created
- `companions/<slug>/manifest.ts`
- `companions/<slug>/types.ts`
- `companions/<slug>/server/tools.ts`
- `skills/<slug>-companion/SKILL.md`

### Files modified
- `companions/<slug>/index.ts` (auto-generated)
- `companions/index.ts` (auto-regenerated)
- `companions/client.ts` (auto-regenerated)
- `package.json` — added <SDK list>

### Validation
- ✓ validator
- ✓ smoke (<N> tools)

### Next step
Start a new Claude Code session in this repo and paste:
`/<slug>-companion <new-entity-id>`
```

```
mcp__claudepanion__build_save_artifact({ id, artifact: { summary: "Built <slug>: <one line>", markdown: <above>, ...extras } })
mcp__claudepanion__build_update_status({ id, status: "completed" })
```

## Iterate-mode sub-flow

1. `build_get`; verify target exists and `target !== "build"`.
2. Read every file under `companions/<target>/` and `skills/<target>-companion/SKILL.md`.
3. `build_update_status` running.
4. Apply the requested change to the affected files (manifest / types / tools / skill body).
5. Bump version in `manifest.ts` — patch for fix/typo, minor for additions, major for breaking.
6. `claudepanion scaffold <target>`.
7. Branch on result (Step 8 table above).
8. Ask the user whether to commit (same gate as Step 9 in new-companion mode). Only run `git add companions/<target> skills/<target>-companion` (+ `package.json` if changed) and commit if they confirm.
9. `build_save_artifact` (markdown of what changed) + `build_update_status` completed.

---

## SDK guidance

| External system | SDK | Credential default |
|---|---|---|
| AWS | `@aws-sdk/client-<service>` | `fromNodeProviderChain({ profile })` from `@aws-sdk/credential-providers` |
| GitHub | `@octokit/rest` | env `GITHUB_TOKEN` (PAT, `repo` scope) |
| Linear | `@linear/sdk` | env `LINEAR_API_KEY` |
| Slack | `@slack/web-api` | env `SLACK_BOT_TOKEN` |
| OpenAI | `openai` | env `OPENAI_API_KEY` |
| Generic HTTP | built-in `fetch` | varies — document required env in manifest |

The skill teaches the canonical `[config]` / `[input]` / `[transient]` taxonomy in the worked example below; per-service mappings are copy-paste.

---

## Worked example: PR reviewer

User submits a Build form with:

> "Review a PR in this repo — fetch the diff and existing comments, flag risky diffs, suggest review questions for the author. Optionally post a structured review back. GitHub-only, requires GITHUB_TOKEN."

### Interpretation (echoed back to the user)

```
Interpreted as with-write companion against GitHub.
  Form fields: { repo: string, prNumber: number, focus?: string, postBack: boolean }
  Tools: pr_reviewer_get_pr (read), pr_reviewer_get_diff (read),
         pr_reviewer_get_comments (read), pr_reviewer_post_review (write)
  Artifact extras: { prNumber: number, recommendation: "approve" | "request_changes" | "comment" }
  SDK: @octokit/rest; credentials: env GITHUB_TOKEN
```

### Authored `companions/pr-reviewer/manifest.ts`

```ts
import type { Manifest } from "../../src/shared/types.js";

export const manifest: Manifest = {
  name: "pr-reviewer",
  kind: "ui",
  displayName: "PR Reviewer",
  icon: "👀",
  description: "Review a GitHub PR — fetch the diff, flag risky changes, suggest review questions, optionally post a structured review.",
  contractVersion: "2",
  version: "0.1.0",
  requiredEnv: ["GITHUB_TOKEN"],
};
```

### Authored `companions/pr-reviewer/types.ts`

```ts
import { z } from "zod";
import type { BaseArtifact } from "../../src/shared/types.js";

export const InputSchema = z.object({
  repo: z.string().min(1).describe("Repo (owner/name)"),
  prNumber: z.number().int().positive().describe("PR number"),
  focus: z.string().optional().describe("Optional focus area (e.g. 'security', 'perf')")
    .meta({ ui: { kind: "textarea" } }),
  postBack: z.boolean().default(false).describe("Post the review back to the PR"),
});

export type Input = z.infer<typeof InputSchema>;

export interface ArtifactExtras {
  prNumber: number;
  recommendation: "approve" | "request_changes" | "comment";
}

export type Artifact = BaseArtifact & ArtifactExtras;
```

### Authored `companions/pr-reviewer/server/tools.ts`

```ts
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { defineTool } from "../../../src/shared/define-tool.js";
import {
  successResult,
  configErrorResult,
  inputErrorResult,
  transientErrorResult,
  errorResult,
} from "../../../src/shared/types.js";

function classifyGithubError(err: unknown) {
  const e = err as { status?: number; message?: string };
  const msg = e?.message ?? String(err);
  if (e?.status === 401 || e?.status === 403) return configErrorResult("GITHUB_TOKEN", `auth failed: ${msg}`);
  if (e?.status === 404 || e?.status === 422) return inputErrorResult(`not found / unprocessable: ${msg}`);
  if (e?.status === 429 || (e?.status ?? 0) >= 500) return transientErrorResult(`upstream: ${msg}`);
  return errorResult(msg);
}

function octokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  return new Octokit({ auth: token });
}

export const tools = [
  defineTool({
    name: "pr_reviewer_get_pr",
    description: "Fetch PR metadata (title, author, base/head, mergeable). Read-only.",
    sideEffect: "read",
    schema: { repo: z.string(), prNumber: z.number().int().positive() },
    async handler({ repo, prNumber }) {
      const gh = octokit();
      if (!gh) return configErrorResult("GITHUB_TOKEN", "set a PAT with repo scope");
      const [owner, name] = repo.split("/");
      if (!owner || !name) return inputErrorResult("repo must be 'owner/name'");
      try {
        const { data } = await gh.pulls.get({ owner, repo: name, pull_number: prNumber });
        return successResult(data);
      } catch (err) { return classifyGithubError(err); }
    },
  }),
  defineTool({
    name: "pr_reviewer_get_diff",
    description: "Fetch the unified diff for the PR. Read-only.",
    sideEffect: "read",
    schema: { repo: z.string(), prNumber: z.number().int().positive() },
    async handler({ repo, prNumber }) {
      const gh = octokit();
      if (!gh) return configErrorResult("GITHUB_TOKEN", "set a PAT with repo scope");
      const [owner, name] = repo.split("/");
      try {
        const { data } = await gh.pulls.get({
          owner, repo: name, pull_number: prNumber,
          mediaType: { format: "diff" },
        });
        return successResult({ diff: data as unknown as string });
      } catch (err) { return classifyGithubError(err); }
    },
  }),
  defineTool({
    name: "pr_reviewer_get_comments",
    description: "Fetch existing review comments on the PR. Read-only.",
    sideEffect: "read",
    schema: { repo: z.string(), prNumber: z.number().int().positive() },
    async handler({ repo, prNumber }) {
      const gh = octokit();
      if (!gh) return configErrorResult("GITHUB_TOKEN", "set a PAT with repo scope");
      const [owner, name] = repo.split("/");
      try {
        const { data } = await gh.pulls.listReviewComments({ owner, repo: name, pull_number: prNumber });
        return successResult(data);
      } catch (err) { return classifyGithubError(err); }
    },
  }),
  defineTool({
    name: "pr_reviewer_post_review",
    description: "Post a structured review back to the PR. Visible to all collaborators on the repo and cannot be unsent. Requires GITHUB_TOKEN with 'repo' scope.",
    sideEffect: "write",
    schema: {
      repo: z.string(),
      prNumber: z.number().int().positive(),
      event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
      body: z.string().min(1),
    },
    async handler({ repo, prNumber, event, body }) {
      const gh = octokit();
      if (!gh) return configErrorResult("GITHUB_TOKEN", "set a PAT with repo scope");
      const [owner, name] = repo.split("/");
      try {
        const { data } = await gh.pulls.createReview({ owner, repo: name, pull_number: prNumber, event, body });
        return successResult({ id: data.id, htmlUrl: data.html_url });
      } catch (err) { return classifyGithubError(err); }
    },
  }),
];
```

### Authored `skills/pr-reviewer-companion/SKILL.md`

```markdown
---
name: pr-reviewer-companion
description: Use when the user pastes "/pr-reviewer-companion <entity-id>" — reviews a GitHub PR and (optionally) posts a structured review back.
---

# /pr-reviewer-companion <entity-id>

> Read-only by default. Posts a review only when `postBack` is true AND the user explicitly confirms.

## Step 0 — Verify the claudepanion MCP is connected

**This MUST be the first thing you do.** If Step 1 below returns "tool not available", "MCP server not connected", or any analogous failure, **STOP**. Do not read files, run Bash, or investigate the PR manually. Tell the user:

> I can't reach the claudepanion MCP server. Try these in order:
>
> 1. Run `/mcp` and check whether `claudepanion` is listed (and not errored).
> 2. Confirm the claudepanion server is running — open <http://localhost:3001> or run `lsof -i :3001`. If not, run `claudepanion serve`.
> 3. Re-install the plugin in this repo: `claudepanion plugin install`.
> 4. Rebuild the claudepanion checkout: `npm run build`.
> 5. Start a **new** Claude Code session and re-run `/mcp` to confirm — then re-paste the slash command.

## Step 1 — Load
`mcp__claudepanion__pr_reviewer_get({ id })`

## Step 2 — Mark running
`mcp__claudepanion__pr_reviewer_update_status({ id, status: "running", statusMessage: "fetching PR" })`

## Step 3 — Validate
Confirm `repo`, `prNumber`, `GITHUB_TOKEN` set.

## Step 4 — Do the work

### 4a — Fetch the PR
`mcp__claudepanion__pr_reviewer_get_pr({ repo, prNumber })`
`mcp__claudepanion__pr_reviewer_append_log({ id, message: "Fetched PR #<n>: <title>" })`

### 4b — Read the diff
`mcp__claudepanion__pr_reviewer_get_diff({ repo, prNumber })`
`mcp__claudepanion__pr_reviewer_append_log({ id, message: "Read diff (<lines> lines)" })`

### 4c — Read existing comments
`mcp__claudepanion__pr_reviewer_get_comments({ repo, prNumber })`
`mcp__claudepanion__pr_reviewer_append_log({ id, message: "<n> existing comments" })`

### 4d — Analyze
Read the diff with `focus` in mind. Build a list of risks and review questions. Pick one of `approve` / `request_changes` / `comment`.

### 4e — (postBack only) Post the review
**Show the user the proposed review body in chat.** Ask: "Should I post this review to PR #<n>?" Wait for confirmation.

If confirmed:
`mcp__claudepanion__pr_reviewer_post_review({ repo, prNumber, event, body })`

If declined: skip the call; add `"user declined to post review"` to `artifact.errors[]` and continue.

## Step 5 — Save artifact
`mcp__claudepanion__pr_reviewer_save_artifact({ id, artifact: { summary, markdown, prNumber, recommendation } })`

## Step 6 — Complete
`mcp__claudepanion__pr_reviewer_update_status({ id, status: "completed" })`
```

### Scaffold CLI invocation

```
$ claudepanion scaffold pr-reviewer
{ "ok": true, "slug": "pr-reviewer", "kind": "ui",
  "stagesRun": ["validate","deps","codegen","build","remount","self-check"],
  "filesGenerated": ["companions/pr-reviewer/index.ts","companions/index.ts","companions/client.ts"],
  "dependenciesAdded": ["@octokit/rest@^21.0.0"],
  "selfCheck": { "validator": { "ok": true }, "smoke": { "ok": true } } }
```

### Markdown artifact saved by the build skill

```markdown
## Built `pr-reviewer`

GitHub PR reviewer. Read-only by default; can post a structured review back when the user confirms. Requires `GITHUB_TOKEN` with `repo` scope.

**Tools:** `pr_reviewer_get_pr`, `pr_reviewer_get_diff`, `pr_reviewer_get_comments`, `pr_reviewer_post_review` (write)

### Files created
- `companions/pr-reviewer/manifest.ts`
- `companions/pr-reviewer/types.ts`
- `companions/pr-reviewer/server/tools.ts`
- `skills/pr-reviewer-companion/SKILL.md`

### Files modified
- `companions/pr-reviewer/index.ts` (auto-generated)
- `companions/index.ts` (auto-regenerated)
- `companions/client.ts` (auto-regenerated)
- `package.json` — added @octokit/rest

### Validation
- ✓ validator
- ✓ smoke (4 tools)

### Next step
Start a new Claude Code session in this repo and paste:
`/pr-reviewer-companion <new-entity-id>`
```

---

## Common mistakes

### STOP — do not proceed
- About to curl `/api/entities/*` to mutate state.
- About to write directly to `data/**/*.json`.
- About to leave `<<<INSERT PLAYBOOK HERE>>>` (or any placeholder) in the authored SKILL.md.
- About to mark `completed` without `claudepanion scaffold`'s self-check having passed.

### Hygiene — fix before commit
- `git add` missed `package.json` (and `package-lock.json`) after a dependency change.
- Skill description is generic ("Helps with X") instead of specific (what data, what action, what credentials).
- `ArtifactExtras` has fields no list-row override consumes — delete them; rendering is markdown.

---

## Error handling

| Prefix | Action |
|---|---|
| `[config]` | `_fail`; stop. User must fix env / credentials. |
| `[input]` | `_fail`; stop. User must fix the form. |
| `[transient]` | retry once; `_fail` if still failing. |
| `[recoverable]` | log warn; append to `artifact.errors[]`; continue. |
| (no prefix) | treat as fatal; `_fail`. |
