---
name: build-companion
description: Use when the user pastes "/build-companion <entity-id>" — scaffolds a new companion or iterates on an existing one for claudepanion.
---

# /build-companion <entity-id>

Claudepanion's built-in companion that scaffolds or iterates on other companions.

> **CRITICAL — MCP tools ONLY:**
> - ALL state changes (status, logs, artifact, failure) go through tools prefixed `mcp__claudepanion__`.
> - NEVER curl the REST API at `/api/entities/*` to mutate state.
> - NEVER edit `data/build/<id>.json` directly.
> - If an MCP tool returns an error, call `mcp__claudepanion__build_fail` with the error and stop. Do NOT fall back to HTTP.
> - If MCP tools are unavailable in your session, STOP and tell the user: *"MCP tools from claudepanion are not loaded — verify `claudepanion plugin install` and that the server is running, then start a new Claude Code session."* Do not proceed.

> **All validation goes through MCP.** Use `mcp__claudepanion__build_self_check` (Step 6) to verify a just-scaffolded companion — no curl, no sleep, no REST. Reading entity state via REST is allowed for verification but NEVER for mutation.

> **Your job (per scaffold-spec §16):** produce a *complete, working companion*, not a token-substituted skeleton. The templates exist as a starting reference for boilerplate, but Step 4 authors **real domain content** for every file — types, form, list, detail, server/tools.ts (real proxy tool handlers), and the skill body. Empty server/tools.ts when an external system was named is a build failure.

## Step 1 — Load the Build entity

```
mcp__claudepanion__build_get({ id: "<entity-id>" })
```

Read `entity.input.mode`. Branch:

- `"new-companion"` → go to **Mode: new-companion** below.
- `"iterate-companion"` → go to **Mode: iterate-companion** below.

## Step 1.5 — Detect continuation

If `entity.artifact !== null`, this is a continuation — the user clicked "Continue" on a previously completed Build run. The prior `filesCreated` / `filesModified` are already on disk. The new `entity.input.description` is the user's redirection ("do this differently this time").

Read the prior artifact carefully. Apply the redirection by *modifying* the existing companion files, not by re-scaffolding from scratch. Save a complete updated artifact when done (the prior artifact is replaced when `_save_artifact` is called again).

```
mcp__claudepanion__build_append_log({ id: "<entity-id>", message: "Continuing prior Build run — applying redirected description to existing companion files" })
```

---

## Mode: new-companion

### Step 2 — Validate + resolve substitution tokens

`entity.input` has `name`, `kind`, and `description`. Reject if:

- `name` doesn't match `/^[a-z][a-z0-9-]*$/`.
- `kind` is not `"entity"` or `"tool"`.
- `companions/<name>/` already exists on disk.

On reject:

```
mcp__claudepanion__build_fail({ id: "<entity-id>", errorMessage: "<specific reason>" })
```

Compute substitution tokens. This is mechanical — apply exactly:

| Token | Derivation | Example (`pr-reviewer`) |
|---|---|---|
| `__NAME__` | the slug | `pr-reviewer` |
| `__CAMEL__` | camelCase — strip hyphens, uppercase the next letter | `prReviewer` |
| `__PASCAL__` | first char of `__CAMEL__` uppercased | `PrReviewer` |
| `__DISPLAY__` | titleized — split on hyphens, capitalize each word | `Pr Reviewer` |
| `__ICON__` | one emoji that fits `description` | `🔎` |
| `__DESCRIPTION__` | `entity.input.description` collapsed to one line | `Review a PR in this repo…` |

### Step 2.5 — Interpret the description (§16b — the load-bearing decision step)

Read `entity.input.description` carefully. Before writing any file, decide all five things below. The decisions you make here shape every subsequent step.

**1. External system** — which API will the companion talk to (GitHub, AWS, Linear, Slack, OpenAI, generic HTTP)? Default assumption: every companion has at least one proxy tool. A description that names no external system is the rare case — confirm by asking yourself *"what data does this companion need that Claude can't reach without an authenticated proxy?"*

**2. Read vs write** — does the description explicitly request actions that change external state?

| User wrote… | Action |
|---|---|
| "review PRs", "investigate logs", "check Linear", "summarize Slack" | Scaffold READ-only tools |
| "post a review", "update an issue", "send a message", "create an alarm" | Scaffold READ tools + the explicitly-requested WRITE tools (set `sideEffect: "write"`) |
| Vague description ("PR helper", "incident tool") | Default to READ-only (§9e.iv) |

**3. Form fields (input shape)** — what configuration does the user provide on each run that makes a general query specific? The form captures **WHERE/WHICH**, not "paste your text." Examples:
- GitHub PR review → `{ repo: string; prNumber: number; focus?: string }`
- AWS log investigation → `{ profile: string; logGroup: string; startTime: string; endTime: string; filter?: string }`
- Linear triage → `{ teamId: string; label?: string; staleAfterDays?: number }`

**4. Artifact fields (output shape)** — what domain fields does the user want the Detail page to render? `BaseArtifact` already provides optional `summary?: string` and `errors?: string[]`. Domain fields make the artifact useful:
- PR review → `{ prTitle, prUrl, risks: string[], questions: string[], recommendation: "approve" | "request_changes" | "comment" }`
- Log investigation → `{ alarmName, eventCount, errorPatterns: string[], rootCauseHypotheses: string[] }`

**5. Proxy tools (one per external API call)** — list them. Each maps to a single API method.
- PR review (read-only) → `pr_reviewer_get_pr`, `pr_reviewer_get_diff`, `pr_reviewer_get_comments`
- PR review (with post-back) → above + `pr_reviewer_post_review` (`sideEffect: "write"`)

#### SDK and env-var lookup (§16c)

| Service | Recommended SDK | Required env var | Notes |
|---|---|---|---|
| GitHub API | `@octokit/rest` | `GITHUB_TOKEN` | Personal access token, `repo` scope |
| AWS (any service) | `@aws-sdk/client-<service>` | (none) | Profile passed as tool arg, credentials from `~/.aws/credentials` |
| Linear API | `@linear/sdk` | `LINEAR_API_KEY` | Personal API key |
| Slack API | `@slack/web-api` | `SLACK_BOT_TOKEN` | Bot token starting with `xoxb-` |
| OpenAI API | `openai` | `OPENAI_API_KEY` | |
| Generic HTTP | built-in `fetch` | varies | Document required env vars in the manifest |

Pick the SDK matching the external system. The chosen env var(s) go into `manifest.requiredEnv`.

#### Echo the interpretation back to the user

This is a deliberate checkpoint. **Before writing any file**, append a structured multi-line log so the user watching the live tail can confirm Build interpreted their description correctly. Catching a misread here is cheap; catching it after files are on disk requires a re-run.

Append the interpretation as one log call (newlines are preserved by the UI):

```
mcp__claudepanion__build_append_log({
  id: "<entity-id>",
  message: "Interpreted as <read-only|with-write> companion against <external-system>.\n  Form: { <field>: <type>, ... }\n  Artifact: { <field>: <type>, ... }\n  Tools: <tool-name-1>, <tool-name-2>, ...\n  SDK: <package> + env <ENV_VAR>"
})
```

Then briefly pause (1–2 seconds) so the user has a window to interrupt with `Ctrl-C` and re-trigger Build with feedback if any of the above is wrong. Carry these decisions forward to Step 4 (author files) and Step 4.6 (package.json).

### Step 3 — Mark running

The statusMessage carries the one-line interpretation summary so the UI status pill conveys what Build understood, not just "scaffolding."

```
mcp__claudepanion__build_update_status({
  id: "<entity-id>",
  status: "running",
  statusMessage: "scaffolding <name> (<read-only|with-write>, <external-system>, <N> tools)"
})
```

### Step 4 — Author each companion file (§16d — the load-bearing step)

Write each of the files below with **real domain content** based on the Step 2.5 interpretation. The templates under `companions/build/templates/` exist as a starting reference — particularly for boilerplate (imports, JSX scaffolding, error helpers) — but you do not do a "tokenize-substitute-then-replace" pass. Author the real content directly.

This is the load-bearing step. If the description named an external system but `server/tools.ts` ends up an empty array, you have produced a UI with no backend. Step 6 self-check will fail the build.

For `kind: "entity"`, create `companions/__NAME__/` with these files. For `kind: "tool"`, only the `manifest.ts`, `index.ts`, and `server/tools.ts` files apply.

| File | What to author |
|---|---|
| `manifest.ts` | Complete manifest — `name: "__NAME__"`, `kind`, `displayName: "__DISPLAY__"`, `icon: "__ICON__"` (one emoji), `description` (one user-facing sentence), `contractVersion: "1"`, `version: "0.1.0"`, **`requiredEnv`** per Step 2.5's SDK lookup. |
| `types.ts` | Real `__PASCAL__Input` (fields from Step 2.5.3, capturing WHERE/WHICH) and `__PASCAL__Artifact extends BaseArtifact` (fields from Step 2.5.4, the domain output). Both JSON-serializable. |
| `index.ts` | `export const __CAMEL__: RegisteredCompanion = { manifest, tools };` — wires the manifest + tools together. |
| `form.tsx` | One input element per `__PASCAL__Input` field — strings → `<input type="text">` (or `<select>` for finite sets), numbers → `<input type="number">`. Required fields have client-side validation; optional fields pass `undefined` if blank. Call `onSubmit` with a fully-shaped `__PASCAL__Input`. (entity kind only) |
| `pages/List.tsx` | Render a meaningful row from `entity.input` + `entity.artifact` fields. e.g. PR reviewer → `<repo>#<prNumber> — <recommendation>`. (entity kind only) |
| `pages/Detail.tsx` | Render the artifact's domain fields. Host wraps in `<BaseArtifactPanel>` automatically (handles `summary` + `errors[]`) — render only the domain middle. (entity kind only) |
| `server/tools.ts` | Real `CompanionToolDefinition[]` — one tool per Step 2.5.5 entry. **THE MOST IMPORTANT FILE.** Empty array = build failure when an external system was named. See pattern below. |
| `skills/__NAME__-companion/SKILL.md` | Full skill body. Frontmatter, the standard CRITICAL block, Steps 1–6 + error handling. **Step 4 ("Do the work") must be a sequenced playbook of proxy-tool calls** for the tools you authored — not a pasted `__DESCRIPTION__`. The directory `skills/__NAME__-companion/` must exist (nested layout, literal filename `SKILL.md`). |

#### `server/tools.ts` — the §9d pattern

Each tool: validate config → validate input → call API → classify error → return.

```ts
import { z } from "zod";
import { Octokit } from "@octokit/rest";  // or whichever SDK Step 2.5 picked
import type { CompanionToolDefinition } from "../../../src/shared/types.js";
import {
  successResult,
  errorResult,
  configErrorResult,
  inputErrorResult,
  transientErrorResult,
} from "../../../src/shared/types.js";

export const tools: CompanionToolDefinition[] = [
  {
    name: "__NAME___fetch_thing",  // hyphens in slug → underscores
    description: "<one user-facing sentence — what does this tool do, what external system, what credentials>",
    schema: {
      // Zod raw shape — describe each param
    },
    async handler(params: { /* match schema */ }) {
      const token = process.env.GITHUB_TOKEN;  // matches manifest.requiredEnv
      if (!token) return configErrorResult("GITHUB_TOKEN", "create a token at github.com/settings/tokens");
      // validate input
      // try { call API } catch { classify err.status / err.code }
      return successResult(data);
    },
  },
  // ... one per API call
];
```

For **write tools**: set `sideEffect: "write"` and make the description's side-effect explicit (per §9e.i). Bad: `"Post a comment to GitHub"`. Good: `"Post a structured review comment to the PR. Visible to all collaborators on the repo and cannot be unsent. Requires GITHUB_TOKEN with 'repo' scope."`

#### Skill body's "Step 4 — Do the work"

In the new skill file, Step 4 is a sequenced playbook for THIS companion's proxy tools — not generic placeholder text. Each sub-step is a tool call + a log line:

```
### 4a — Fetch the PR

mcp__claudepanion__pr_reviewer_get_pr({ repo: <from input>, prNumber: <from input> })
mcp__claudepanion__pr_reviewer_append_log({ id, message: "Fetched PR #<n> (<title>)" })

### 4b — Read the diff
...
```

For any **write tool** (`sideEffect: "write"`), include an explicit user-permission sub-step before the call (§9e.ii):

> Show the proposed write content in chat. Ask "Should I post this?". Wait for confirmation. Only call the write tool if confirmed; if declined, save the artifact with `errors: ["user declined write action"]` and proceed.

#### Log progress as you go

```
mcp__claudepanion__build_append_log({ id: "<entity-id>", message: "wrote <path>" })
```

#### Final log for Step 4

```
mcp__claudepanion__build_append_log({ id: "<entity-id>", message: "Authored: manifest, types, form, List/Detail, server/tools.ts (<N> tools), SKILL.md" })
```

### Step 4.6 — Update root `package.json` and run `npm install` (§16e)

If Step 2.5 picked an SDK that isn't already a host dependency, add it now.

1. Read `package.json` at the repo root.
2. Add the SDK to `dependencies`.
3. Run:

```bash
npm install
```

4. Wait for `npm install` to complete. The watcher uses dist/ output; `tsc` rebuild is required for the new companion's TS to be visible (production: at server start; dev: see `docs/followups.md` § Dev-mode ergonomics).

Log:

```
mcp__claudepanion__build_append_log({ id: "<entity-id>", message: "Added <package> to dependencies; npm install completed" })
```

If the SDK is already in `package.json`, skip the edit but still log.

### Step 5 — Register the companion in the host

Two files. Both load-bearing — miss either and the companion won't work.

#### Step 5a — `companions/index.ts`

Read it first. Current shape:

```ts
import type { RegisteredCompanion } from "../src/server/companion-registry.js";
import { build } from "./build/index.js";
// ...other existing imports, alphabetical by slug

export const companions: RegisteredCompanion[] = [build /*, ...alphabetical */];
```

Add an import for the new companion's binding (`__CAMEL__` is the exported binding):

```ts
import { __CAMEL__ } from "./__NAME__/index.js";
```

Insert in alphabetical slug order. Add `__CAMEL__` to the `companions` array, preserving alphabetical order.

#### Step 5b — `companions/client.ts` (entity kind ONLY)

Skip for `kind: "tool"`. For entity kind, read `companions/client.ts`, then add:

```ts
import __PASCAL__Detail from "./__NAME__/pages/Detail";
import __PASCAL__ListRow from "./__NAME__/pages/List";
import __PASCAL__Form from "./__NAME__/form";

// artifactRenderers:
  "__NAME__": __PASCAL__Detail as ArtifactRenderer,
// listRows:
  "__NAME__": __PASCAL__ListRow as ListRow,
// forms:
  "__NAME__": __PASCAL__Form as CompanionForm,
```

Log:

```
mcp__claudepanion__build_append_log({ id: "<entity-id>", message: "registered __NAME__ in companions/index.ts and companions/client.ts" })
```

### Step 6 — Self-check (§16f)

Run a single synchronous validation:

```
mcp__claudepanion__build_update_status({ id: "<entity-id>", status: "running", statusMessage: "validating" })
mcp__claudepanion__build_self_check({ companion: "__NAME__" })
```

`build_self_check` runs the full §16f validator + smoke synchronously and returns:

```json
{
  "ok": <boolean>,
  "validator": { "ok": <boolean>, "issues": [{ "code", "message", "fatal" }] },
  "smoke":     { "ok": <boolean>, "results": [{ "tool", "ok" }] },
  "ranAt":     "<ISO timestamp>"
}
```

The validator already enforces the §16f rules from the spec:

- `tools.empty_with_requiredEnv` — `requiredEnv` declared but `server/tools.ts` is empty (§16f.1, fatal)
- `env.referenced_not_declared` / `env.declared_not_used` — env vars in handlers must match `requiredEnv` (§16f.2, warn)
- `tool.name.namespace` — every tool prefixed with the slug (hyphens→underscores)
- `skill.missing` / `skill.frontmatter.*` — skill file exists with required frontmatter
- `index.export.missing` — companion's `index.ts` exports the camelCase binding
- `file.missing` — required companion files present

Plus smoke: every domain tool runs (or fails the right way) when called with empty args.

#### Branch on the result

If `result.ok === true`:

```
mcp__claudepanion__build_append_log({ id: "<entity-id>", message: "Self-check passed: validator + smoke green" })
```

If `result.ok === false`, gather the fatal issue messages (`validator.issues.filter(i => i.fatal)`) and any failed smoke results, and call:

```
mcp__claudepanion__build_fail({ id: "<entity-id>", errorMessage: "[input] self-check failed: <joined issue messages>" })
```

The `[input]` prefix means the user can re-trigger Build with feedback (e.g. "the description was vague — be more specific about what data the companion needs"). Do not commit a half-built companion.

### Step 7 — Commit

```bash
git add companions/__NAME__ skills/__NAME__-companion companions/index.ts companions/client.ts package.json package-lock.json
git commit -m "companion: scaffold __NAME__"
```

For `kind: "tool"`, omit `companions/client.ts`. If no SDK was added, omit `package.json` and `package-lock.json`.

### Step 8 — Save artifact + complete

```
mcp__claudepanion__build_save_artifact({
  id: "<entity-id>",
  artifact: {
    filesCreated: [<list of new file paths>],
    filesModified: ["companions/index.ts", "companions/client.ts", "package.json"],
    summary: "Built __NAME__ (<kind>) with <N> proxy tools using <SDK>. Start a new Claude Code session in this repo and paste /__NAME__-companion <new-entity-id> to use it.",
    validatorPassed: <bool>,
    smokeTestPassed: <bool>
  }
})
```

Append a final log line so the live tail in the browser shows the next-session instruction even before the artifact renders:

```
mcp__claudepanion__build_append_log({ id: "<entity-id>", message: "Done. Start a new Claude Code session in this repo to use /__NAME__-companion." })
```

Then complete:

```
mcp__claudepanion__build_update_status({ id: "<entity-id>", status: "completed" })
```

If Step 6 self-check reported fatal issues, call `build_fail` instead.

---

## Mode: iterate-companion

### Step 2 — Load target

`entity.input` has `target` (slug) and `description` (what to change). Verify:

- `companions/<target>/` exists on disk.
- `target !== "build"` — self-iteration is disallowed. On violation:

```
mcp__claudepanion__build_fail({ id: "<entity-id>", errorMessage: "cannot iterate on Build itself" })
```

### Step 3 — Mark running

```
mcp__claudepanion__build_update_status({ id: "<entity-id>", status: "running", statusMessage: "reading current source" })
```

### Step 4 — Read current source

Read every file under `companions/<target>/`. Note the manifest version. Read `skills/<target>-companion/SKILL.md` too.

### Step 5 — Apply the change (§16-aware)

```
mcp__claudepanion__build_update_status({ id: "<entity-id>", status: "running", statusMessage: "applying change" })
```

Judgment step. Read `entity.input.description` and make the requested modifications. Keep changes focused on what was asked.

If the change adds a new proxy tool or modifies an existing one, apply the §16d/§16e contract for affected files:

- **New proxy tool** → add to `companions/<target>/server/tools.ts` following §9d pattern (validate config → validate input → call API → classify error → return); update skill body's Step 4 to call it
- **New external system** → declare env var in `manifest.requiredEnv` (§16c), add SDK to root `package.json`, run `npm install`
- **New input field** → update `<Pascal>Input` in `types.ts` AND add the input element to `form.tsx`
- **New artifact field** → update `<Pascal>Artifact` in `types.ts` AND render it in `pages/Detail.tsx`
- **New write tool** → set `sideEffect: "write"`, update skill body's Step 4 with the user-permission stanza (§9e.ii)

After each file change:

```
mcp__claudepanion__build_append_log({ id: "<entity-id>", message: "modified <path>" })
```

### Step 6 — Bump version

Update `companions/<target>/manifest.ts` `version`:

- **Patch** (0.1.0 → 0.1.1) for "fix", "typo", "wording".
- **Major** (0.1.0 → 1.0.0) for explicit "breaking" language.
- **Minor** (0.1.0 → 0.2.0) otherwise.

### Step 7 — Validate

Same as new-companion Step 6 (build_self_check), but for `<target>`.

### Step 8 — Commit

```bash
git add companions/<target> skills/<target>-companion package.json package-lock.json
git commit -m "companion(<target>): <one-line summary>"
```

### Step 9 — Save artifact + complete

```
mcp__claudepanion__build_save_artifact({
  id: "<entity-id>",
  artifact: {
    filesCreated: [],
    filesModified: [<list of modified paths>],
    summary: "Iterated <target>: <one-or-two sentences>. If the change added a new skill step or proxy tool, start a new Claude Code session to pick it up.",
    validatorPassed: <bool>,
    smokeTestPassed: <bool>
  }
})

mcp__claudepanion__build_update_status({ id: "<entity-id>", status: "completed" })
```

---

## Common mistakes

Every row caused a real failure. Don't repeat them.

| Mistake | Fix |
|---|---|
| *"Let me curl the MCP endpoint since the tools aren't loaded."* | STOP. Tell the user MCP tools aren't loaded (see CRITICAL block at top). Do not fall back to HTTP. |
| *"I'll PATCH /api/entities/<id> to update status."* | The REST API has no PATCH endpoint and shouldn't be used for mutations regardless. Use `mcp__claudepanion__build_update_status`. |
| *"I'll write directly to data/build/<id>.json via a Node script."* | Never. State changes go through MCP tools. Direct writes bypass logging, watchers, and session context. |
| **Authoring only the scaffolding shell** — empty `server/tools.ts`, placeholder types. | Step 4 is the load-bearing authoring step. The companion needs REAL content per §16d, not just substituted tokens. |
| **Empty `server/tools.ts` when the description named an external system.** | §16f.1: Step 6 self-check fails the build. Add real `CompanionToolDefinition` entries using the SDK from §16c. |
| **Leaving `__DESCRIPTION__` or the TODO comment in the skill body's Step 4.** | Step 4 (skill body row) authors a sequenced playbook of proxy-tool calls — replace, don't preserve, the TODO comment. |
| **Skipping `npm install` after editing `package.json`.** | Step 4.6: the import won't resolve until the package is installed. Watcher can't compile against missing dependencies. |
| **Skipping `requiredEnv` declaration after adding a tool that reads `process.env.X`.** | §16f.2: Step 6 self-check fails. Update the manifest. |
| **Writing the skill to `skills/<name>-companion.md` (flat).** | Claude Code expects nested. Path is `skills/<name>-companion/SKILL.md`, literal filename `SKILL.md`. |
| **Writing `interface __CAMEL__Input`** (camelCase). | Type names are PascalCase: `interface __PASCAL__Input`. Variable bindings are camelCase. |
| Skipping `companions/client.ts` registration for entity kind. | UI shows *"No form registered"*. Always edit BOTH `index.ts` and `client.ts`. |
| Forgetting `package.json` + `package-lock.json` in `git add`. | Reviewer can't tell what dependency was added. Always include both. |
| **Forgetting to tell the user to start a new Claude Code session.** | Claude Code discovers skills at session start. Step 8's artifact summary AND the final log line must say it explicitly. |

## Red flags — STOP and re-read this skill

- About to write a curl command against `/api/entities`.
- About to invent an MCP tool name not spelled `mcp__claudepanion__build_*` or `mcp__claudepanion__<new-slug>_*`.
- About to edit `data/**/*.json` directly.
- About to skip `companions/client.ts` "because the UI will figure it out."
- About to commit a companion whose `server/tools.ts` is still the empty TODO array.
- About to leave `__DESCRIPTION__` or any `__TOKEN__` in the final skill body.
- About to call `build_update_status({ status: "completed" })` without having run the Step 6 self-check.
- About to substitute `__CAMEL__` where a type is declared.
- About to place a skill file as `skills/<name>.md` instead of `skills/<name>/SKILL.md`.

All of these mean: stop, re-read this skill, try again the correct way.
