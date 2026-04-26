# Companion Scaffold Specification

> **North-star spec.** This document describes what a claudepanion companion is, the primitives the host provides, and the contracts every companion must satisfy. Some sections describe the target state ahead of current implementation — those are flagged 🎯. The rest reflects shipped code.

This is the developer reference for building companions. If you're scaffolding a new one, this is the contract you're writing against.

---

## 1. Overview

A **companion** is a small app living inside the claudepanion host. The host provides a fixed set of primitives — form rendering, entity lifecycle, MCP tool registration, log streaming, artifact persistence, error reporting — and the companion fills in the domain-specific behavior.

Two kinds of companion:

| Kind | Description | Has lifecycle? | Has form? | Has artifact? |
|---|---|---|---|---|
| `entity` | Lifecycle-driven runs (form → pending → running → completed / error) | yes | yes | yes |
| `tool` | Direct MCP tools, no lifecycle. Auto-generated About page with Try-it panel. | no | no | no |

The rest of this spec focuses on `entity` companions, which are the primary kind. `tool` companions are a simpler subset.

**The canonical interaction pattern (entity kind):**

```
FORM ──► ENTITY (pending) ──► CLAUDE CODE HANDOFF ──► GENERIC + PROXY TOOLS ──► ARTIFACT
                  ▲                                           │
                  └─────────── log tail / status morphs ──────┘
```

Each box in this pattern is a primitive the host provides. The companion declares the domain-specific shape of inputs, tools, and artifacts.

---

## 2. Companion Lifecycle

Every entity moves through a four-state machine:

```
pending  ──►  running  ──►  completed
              │
              └──────►  error
```

| State | Meaning | UI surface |
|---|---|---|
| `pending` | Entity created, awaiting Claude Code handoff | Slash command + invitation copy |
| `running` | Claude has started executing the skill | Live log tail, status pill, statusMessage |
| `completed` | Skill finished, artifact saved | Artifact rendered via Detail page |
| `error` | Unrecoverable failure | errorMessage + errorStack shown |

Transitions are driven by the skill calling generic entity tools (`_update_status`, `_save_artifact`, `_fail`). The state itself lives in `data/<companion>/<id>.json`.

Re-engagement: a `completed` entity can be flipped back to `pending` via `POST /api/entities/:id/continue`, preserving the prior artifact as context. The Detail page exposes this as a "Continue" action.

---

## 3. The Manifest

Every companion ships a manifest at `companions/<name>/manifest.ts`:

```ts
export interface Manifest {
  name: string;                          // slug, /^[a-z][a-z0-9-]*$/
  kind: "entity" | "tool";
  displayName: string;                   // shown in sidebar
  icon: string;                          // emoji
  description: string;                   // shown in About page
  contractVersion: string;               // currently "1"
  version: string;                       // semver

  // 🎯 Configuration declarations
  requiredEnv?: string[];                // companion is non-functional without these
  optionalEnv?: string[];                // companion degrades gracefully without these
}
```

The manifest is the companion's passport. The host reads it to:
- Register the companion in the sidebar
- Auto-generate the entity tools (`<name>_get`, etc.)
- Validate config at startup (🎯 via `requiredEnv`)
- Surface metadata to Claude (description used in tool docs)

**Naming rule:** `name` is the canonical slug. All tool names must be prefixed `<name>_`. Imports/exports use camelCase derivative (`my-thing` → `myThing`). Type names use PascalCase derivative (`my-thing` → `MyThing`).

---

## 4. Configuration — `requiredEnv` & Preflight 🎯

External-system companions need credentials. The host provides a generic mechanism so every companion's config story works the same way.

### 4a. Declaring config dependencies

```ts
// companions/pr-reviewer/manifest.ts
export const manifest: Manifest = {
  name: "pr-reviewer",
  // ...
  requiredEnv: ["GITHUB_TOKEN"],
  optionalEnv: [],
};
```

`requiredEnv` is a hard gate: missing values mean the companion cannot run, and the form will not let the user submit.

`optionalEnv` is a soft gate: missing values surface as a warning but the form still allows submission. Used for env vars that enable extra features (e.g., a Slack token that lets the companion also post results, but isn't required for the primary run).

### 4b. The preflight endpoint

The host exposes a generic preflight check:

```
GET /api/companions/:name/preflight
→ {
  ok: boolean,
  missingRequired: string[],      // env vars from requiredEnv that aren't set
  missingOptional: string[],      // env vars from optionalEnv that aren't set
}
```

Any companion can be probed for config readiness without running it. This is the foundation of the form config banner and any future "self-diagnostic" UI.

### 4c. Form integration

When the form mounts:
1. Call `GET /api/companions/<name>/preflight`
2. If `missingRequired` is non-empty: render a blocking config banner. Disable submit. Show the env vars and (where the companion provides hints) how to set them.
3. If `missingOptional` is non-empty: render a soft warning banner. Submit still works.

Banner copy convention:

> ⚠️ **GITHUB_TOKEN is not set.** This companion needs a GitHub personal access token with `repo` scope. [Set it in your environment](docs/path-to-doc.md) and reload this page.

The host provides the banner component (`<PreflightBanner companion="<name>" />`) so every companion's banner looks and behaves the same way.

### 4d. Runtime config check

Even with a preflight banner, env vars can disappear (server restart, process env wiped). Proxy tool handlers should defensively check at call time and return `configErrorResult(envVar, hint?)` if missing — see §10.

---

## 5. The Form

A companion declares its input shape and form UI.

### 5a. Input type

```ts
// companions/<name>/types.ts
export interface PrReviewerInput {
  repo: string;                  // "owner/repo"
  prNumber: number;
  focus?: string;                // optional review focus
}
```

The input type is the contract between the form and the skill — what the form submits is what `_get` returns to Claude.

### 5b. Form component

```ts
// companions/<name>/form.tsx
type CompanionForm = ComponentType<{
  onSubmit: (input: unknown) => void | Promise<void>;
}>;
```

The form renders inputs, validates client-side, and calls `onSubmit` with a fully shaped `PrReviewerInput`. The host's `NewEntity` page wires this to `POST /api/entities`.

**Form responsibilities:**
- Render the inputs the companion needs
- Client-side validation (required fields, format checks)
- Call `onSubmit(input)` with a typed payload
- 🎯 Render the preflight banner above the form when config is missing (host provides the component)

**Form does NOT:**
- Issue MCP calls
- Talk to external systems directly (the skill does this via proxy tools)
- Persist anything (the entity store is the persistence layer)

### 5c. Form registration

Forms are registered in `companions/client.ts`:

```ts
import PrReviewerForm from "./pr-reviewer/form";
const forms: Record<string, CompanionForm> = {
  "pr-reviewer": PrReviewerForm as CompanionForm,
};
```

Host's `getForm(name)` looks up the form for the New Entity route.

---

## 6. The Entity

The entity is the durable state object. Every run produces exactly one entity.

```ts
export interface Entity<Input = unknown, Artifact = unknown> {
  id: string;                          // <name>-abc123
  companion: string;                   // companion slug
  status: "pending" | "running" | "completed" | "error";
  statusMessage: string | null;        // short progress note
  createdAt: string;                   // ISO 8601
  updatedAt: string;                   // ISO 8601
  input: Input;                        // typed per companion
  artifact: Artifact | null;           // typed per companion
  errorMessage: string | null;
  errorStack: string | null;
  logs: LogEntry[];                    // live tail
}

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}
```

Stored as one JSON file per entity at `data/<companion>/<id>.json`. The same shape is read by both:
- the UI (via REST: `GET /api/entities/:id?companion=<name>`)
- the skill (via MCP: `<name>_get`)

**Two bright lines:**
- The UI reads via REST (read-mostly, polled every 2s).
- The skill writes via MCP (write-mostly, one tool call at a time).

Both touch the same JSON file. Concurrent writes are rare (single-user localhost).

---

## 7. The Skill

The skill is the program Claude executes. It lives at `skills/<name>-companion/SKILL.md` (nested, literal `SKILL.md`).

### 7a. Skill frontmatter

```yaml
---
name: pr-reviewer-companion
description: Use when the user pastes "/pr-reviewer-companion <entity-id>" — runs the PR reviewer companion against a GitHub PR.
argument-hint: <entity-id>
---
```

| Field | Purpose |
|---|---|
| `name` | Becomes the slash command (`/pr-reviewer-companion`) |
| `description` | Read by Claude's router to decide when the skill applies |
| `argument-hint` | UI placeholder when the user types the slash command |

### 7b. Skill body — the standard structure

The skill body is markdown. Every entity-kind skill follows this structure:

```markdown
# /<name>-companion <entity-id>

> **CRITICAL — MCP tools ONLY:**
> - All state changes go through mcp__claudepanion__<name>_* tools.
> - NEVER curl /api/entities/* to mutate state.
> - NEVER edit data/<name>/<id>.json directly.
> - On any unrecoverable error, call mcp__claudepanion__<name>_fail and stop.

## Step 1 — Load entity
mcp__claudepanion__<name>_get({ id: "<entity-id>" })

## Step 2 — Preflight check 🎯
[Host-provided pattern — see §10c]

## Step 3 — Mark running
mcp__claudepanion__<name>_update_status({ id, status: "running", statusMessage: "starting" })

## Step 4 — Do the work
### 4a — Domain proxy tools
[Companion-specific — call mcp__claudepanion__<name>_<verb> proxy tools]

### 4b — Local tools (optional)
[Use Claude's Read/Grep/Bash/Edit when local context is needed]

## Step 5 — Save artifact
mcp__claudepanion__<name>_save_artifact({ id, artifact: { ...shape... } })

## Step 6 — Complete
mcp__claudepanion__<name>_update_status({ id, status: "completed" })

## Error handling 🎯
[Standard pattern — see §10b]
```

The host provides this as a template at `companions/build/templates/skill.md`. Per-chip variations live at `companions/build/templates/skill-examples/<slug>.md`.

### 7c. The `$ARGUMENTS` token

Claude Code substitutes `$ARGUMENTS` in the skill body with whatever the user typed after the slash command. By convention, that's the entity ID — `pr-reviewer-abc123`.

### 7d. The continuation contract 🎯

A `completed` entity can be flipped back to `pending` via the Continue action (`POST /api/entities/:id/continue`). The same skill is invoked again with the same entity ID, but the entity now carries the prior artifact as context.

**How the skill detects continuation:**

```
const entity = mcp_call("<name>_get", { id })
const isContinuation = entity.artifact !== null
```

**On continuation, the skill must:**

1. Log: *"Continuing from prior run — reading previous artifact"*
2. Read `entity.artifact` carefully before doing new work
3. Treat any updated input fields as the user's redirection — they're saying "do this differently this time"
4. Produce a **complete, updated artifact** (not a diff). The prior artifact is replaced when `_save_artifact` is called again.

**On fresh run** (no prior artifact): standard execution flow.

The continuation pattern enables iteration without losing context: a user can review an artifact, click Continue with revised input, and Claude picks up with full context of the prior result. This is the natural re-engagement primitive — leaning on it makes companions feel like ongoing relationships rather than one-shot scripts.

The skill template ships with a "Step 1.5 — Detect continuation" stanza pre-filled.

---

## 8. Generic Entity Tools

The host auto-registers six MCP tools per entity companion. These are infrastructure — not declared by the companion.

| Tool | Purpose | Signature |
|---|---|---|
| `<name>_get` | Load the entity | `{ id }` |
| `<name>_list` | List entities, optionally filtered by status | `{ status? }` |
| `<name>_update_status` | Transition state, optionally with statusMessage | `{ id, status, statusMessage? }` |
| `<name>_append_log` | Append to logs[] (UI updates within 2s) | `{ id, message, level? }` |
| `<name>_save_artifact` | Save the artifact | `{ id, artifact }` |
| `<name>_fail` | Flip to error state | `{ id, errorMessage, errorStack? }` |

Each is a `CompanionToolDefinition` with proper Zod schema and description — Claude reads parameter docs directly from the MCP registration.

**Companions never override these.** If a companion needs different state-update semantics, that's a sign of a design problem.

---

## 9. Domain Proxy Tools

The whole point of claudepanion. Every entity companion that's not just a structured-chat wrapper has these.

### 9a. The `CompanionToolDefinition` interface

```ts
export interface CompanionToolDefinition<
  TParams extends Record<string, unknown> = Record<string, unknown>
> {
  name: string;                        // must start with "<companion>_"
  description: string;                 // shown to Claude in MCP tool docs
  schema: z.ZodRawShape;               // Zod params, validated at runtime
  handler: (params: TParams) => Promise<McpToolResult>;
}
```

A proxy tool is a typed object, not a class. The handler is a plain async function.

### 9b. The `McpToolResult` return type

```ts
export interface McpToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: true;
  [key: string]: unknown;              // index signature for MCP SDK compat
}

export function successResult(data: unknown): McpToolResult;
export function errorResult(message: string): McpToolResult;
```

Every handler returns one of these. `successResult(data)` JSON-stringifies non-string data; `errorResult(message)` flips `isError: true` so Claude sees the failure.

### 9c. Where proxy tools live

```
companions/<name>/server/tools.ts
  → exports: CompanionToolDefinition[]
```

The host scans this array, adds the tools to the MCP registry, registers them with the SDK using their `description` and `z.object(schema)`. No manual MCP wiring per companion.

### 9d. Pattern: an external API call

```ts
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import type { CompanionToolDefinition } from "../../../src/shared/types.js";
import { successResult, configErrorResult, transientErrorResult, errorResult } from "../../../src/shared/types.js";

export const tools: CompanionToolDefinition[] = [
  {
    name: "pr_reviewer_get_diff",
    description: "Fetch the unified diff for a GitHub PR.",
    schema: {
      repo: z.string().describe('owner/repo, e.g. "sean1588/claudepanion"'),
      prNumber: z.number().int().positive().describe("PR number"),
    },
    async handler({ repo, prNumber }: { repo: string; prNumber: number }) {
      const token = process.env.GITHUB_TOKEN;
      if (!token) return configErrorResult("GITHUB_TOKEN", "create a personal access token with 'repo' scope");

      const [owner, name] = repo.split("/");
      if (!owner || !name) return errorResult(`[input] repo must be "owner/repo", got "${repo}"`);

      try {
        const gh = new Octokit({ auth: token });
        const { data } = await gh.pulls.get({
          owner, repo: name, pull_number: prNumber,
          mediaType: { format: "diff" },
        });
        return successResult(data);
      } catch (err: any) {
        if (err.status === 404) return errorResult(`[input] PR not found: ${repo}#${prNumber}`);
        if (err.status === 401) return configErrorResult("GITHUB_TOKEN", "token is invalid or expired");
        if (err.status === 403) return transientErrorResult(`GitHub rate limit or permission denied: ${err.message}`);
        if (err.status >= 500) return transientErrorResult(`GitHub server error: ${err.message}`);
        return errorResult(`GitHub API error: ${err.message}`);
      }
    },
  },
];
```

The pattern: validate config → validate input → call the API → classify any error → return.

### 9e. Write-action safety 🎯

Some companions have **write tools** — proxy tools that change state in external systems. Posting a PR review, updating a Linear issue, sending a Slack message, creating an AWS resource. Write tools have permanent side effects and need stricter conventions than read tools.

#### 9e.i. Tool naming and description

Write tool names must signal intent:

- ✅ `_post_review`, `_update_issue`, `_send_message`, `_create_alarm`
- ❌ `_save_review` (ambiguous — is this saving locally or posting?), `_handle_pr` (too generic)

Tool descriptions must explicitly state what gets written and where. Bad/good:

- ❌ `"Post a comment to GitHub"`
- ✅ `"Post a structured review comment to the PR. The comment is visible to all collaborators on the repo and cannot be unsent. Requires GITHUB_TOKEN with 'repo' scope."`

#### 9e.ii. Required: user permission before every write

The skill **MUST** ask the user for explicit permission before calling any write tool. The pattern:

```
Before calling a write tool, the skill must:
1. Show the proposed write content to the user (via Claude's chat output)
2. Ask explicit confirmation: "Should I post this review to GitHub?"
3. Wait for the user's response
4. Only proceed if confirmed
```

This is non-negotiable. Companions that auto-write without asking violate the user's trust and may cause damage that can't be undone. The Claude Code session is what makes this consent flow possible — it's another reason the slash-command handoff is load-bearing (see `docs/followups.md` § Handoff UX).

If the user declines, the skill should still save the artifact (so the work isn't wasted) and note in the artifact that the write was skipped.

#### 9e.iii. About page treatment

The About page (§12c) flags write tools with a different visual treatment so users know what side effects to expect *before* running a companion:

- Read-only companions: subtle "read-only" badge
- Companions with write tools: prominent "writes to external systems" warning, listing which tools have side effects

#### 9e.iv. Build skill bias toward read-only

When the Build companion scaffolds a new companion from a vague user description, **it leans toward read-only proxy tools by default.**

Example: if the user types *"build me a PR reviewer"*, Build creates a companion that produces a structured review artifact — **not** one that auto-posts to GitHub. Write tools are added only when the user explicitly requests them: *"and have it post the review back to GitHub."*

Rationale:

- Read-only operations are idempotent and safe to iterate on. Companions get re-run frequently during development.
- Write operations have permanent consequences and require the user's full attention each time.
- The default should match the lower-risk path. Adding write tools is a deliberate opt-in by the user, not a default expansion of scope.

The Build skill template includes an explicit bias check: when interpreting the user's request, identify whether write actions are explicitly requested. If not, default to read-only.

---

## 10. Error Handling 🎯

Errors are first-class. Every proxy companion encounters them; the host standardizes how they're surfaced and handled.

### 10a. The four error classes

| Class | Prefix | Recovery |
|---|---|---|
| `config` | `[config]` | User fixes env var or credential. Skill calls `_fail` immediately. |
| `input` | `[input]` | User re-runs with corrected form input. Skill calls `_fail` immediately. |
| `transient` | `[transient]` | Skill retries once with backoff, then `_fail` if still failing. |
| `recoverable` | `[recoverable]` | Skill logs warning, continues, notes in artifact `errors` array. |

The class is encoded as a prefix on the error message so any client (skill, log viewer, future tooling) can branch on it.

### 10b. Helper functions

The host provides four helpers in `src/shared/types.ts`:

```ts
export function errorResult(message: string): McpToolResult;
// Generic — use when none of the classes fit.

export function configErrorResult(envVar: string, hint?: string): McpToolResult;
// Returns: errorResult(`[config] ${envVar} is not set${hint ? ` — ${hint}` : ""}`)

export function inputErrorResult(message: string): McpToolResult;
// Returns: errorResult(`[input] ${message}`)

export function transientErrorResult(message: string): McpToolResult;
// Returns: errorResult(`[transient] ${message}`)

// recoverable errors are logged via _append_log({ level: "warn" }) — not returned as errors
```

Companion authors use these in proxy tool handlers (see §9d).

### 10c. The skill's standard error handling

The skill template includes a fixed pattern:

```markdown
## Step 2 — Preflight check 🎯

Before doing any work, verify config:

curl -s http://localhost:3001/api/companions/<name>/preflight

If the response shows missingRequired non-empty, call:
mcp__claudepanion__<name>_fail({ id, errorMessage: "[config] missing: <list>" })
and stop.

## Error handling

When a proxy tool returns an error, branch on the prefix:

- [config]      → call <name>_fail({ id, errorMessage: <message> }) and stop
- [input]       → call <name>_fail({ id, errorMessage: <message> }) and stop
- [transient]   → call <name>_append_log({ id, message: <message>, level: "warn" })
                  retry the tool ONCE
                  if still failing, call <name>_fail
- [recoverable] → call <name>_append_log({ id, message: <message>, level: "warn" })
                  continue
                  add the message to the artifact's errors[] field
- (no prefix)   → treat as fatal: <name>_fail
```

This is the same for every companion. The skill template ships with this section pre-filled.

### 10d. The artifact `errors` convention

Every artifact type optionally carries an `errors?: string[]` field for partial-success runs:

```ts
export interface PrReviewerArtifact {
  prTitle: string;
  prUrl: string;
  reviewPosted: boolean;
  summary: string;
  risks: string[];
  questions: string[];
  recommendation: "approve" | "request_changes" | "comment";
  errors?: string[];                   // any [recoverable] issues encountered
}
```

This is convention, not enforced by a base type. The skill populates it from log warnings; the Detail page renders it as a "Notes during this run" section.

---

## 11. The Artifact

The artifact is the durable output of a run. Saved via `_save_artifact`, rendered by the Detail page.

### 11a. Artifact type

Defined in `companions/<name>/types.ts` alongside the input type:

```ts
export interface PrReviewerArtifact {
  prTitle: string;
  prUrl: string;
  reviewPosted: boolean;
  summary: string;
  risks: string[];
  questions: string[];
  recommendation: "approve" | "request_changes" | "comment";
  errors?: string[];
}
```

Conventions:
- One artifact type per companion.
- All fields the Detail page references must be defined in the type.
- Optional `errors?: string[]` per §10d.
- Should be JSON-serializable (no functions, no Dates — use ISO strings).

### 11.5. The `BaseArtifact` interface

Every companion's artifact type should extend `BaseArtifact`:

```ts
export interface BaseArtifact {
  /** Short one-liner describing the run's outcome. Shown in List row + Detail header. */
  summary?: string;
  /** Recoverable issues during the run. Rendered as "Notes during this run" by the host. */
  errors?: string[];
}
```

The host wraps every Detail page renderer in `<BaseArtifactPanel>` which automatically renders `summary` (top banner) and `errors[]` (bottom section). Companion authors only render their domain-specific middle content.

Companions can make `summary` required by overriding the type in the extended interface (e.g., `BuildArtifact.summary: string`).

### 11b. Detail rendering

```ts
// companions/<name>/pages/Detail.tsx
type ArtifactRenderer = ComponentType<{ entity: Entity }>;

export default function PrReviewerDetail({ entity }: { entity: Entity<PrReviewerInput, PrReviewerArtifact> }) {
  if (!entity.artifact) return null;
  // render entity.artifact however makes sense
}
```

Registered in `companions/client.ts`. Host's `getArtifactRenderer(name)` resolves the component for a completed entity.

---

## 12. List & Detail Pages

### 12a. The List row

```ts
// companions/<name>/pages/List.tsx
type ListRow = ComponentType<{ entity: Entity }>;
```

Renders one entity's summary row in the companion's list view. Host wraps it with status pill, timestamp, and a link to the Detail page.

### 12b. The Detail page

The host provides the Detail page chrome (header, status pill, log tail, artifact area, Continue button). The companion provides only the artifact renderer (§11b) — the rest is generic.

### 12c. The About page 🎯

Every companion has an auto-generated About page at `/c/<name>` that serves as the user's first exposure before creating an entity. Rendered by the host from the manifest, preflight, and tool definitions — no per-companion code.

**The About page renders:**

- Manifest fields: `displayName`, `icon`, `description`, `version`
- Preflight status (live): `requiredEnv` and `optionalEnv` with their current set/missing state. Banner if anything is missing.
- Domain proxy tools: list of tool names + descriptions, pulled directly from `CompanionToolDefinition`
- Write tools: flagged separately with a "writes to external systems" badge and the specific external system listed
- Action: "Start a new run" button (or for tool-kind, the existing Try-it panel)

**Visual differentiation:**

- Read-only companions: subtle "read-only" badge in the header
- Companions with write tools: prominent warning banner near the top, listing each write tool with its description

**Implementation:** single `<CompanionAbout>` component the host renders for any companion. Companion authors don't write About pages.

For tool-kind companions, the About page also includes the Try-it panel (already shipped).

---

## 13. Registration & Discovery

### 13a. File structure

```
companions/<name>/
├── manifest.ts            # Manifest export
├── index.ts               # RegisteredCompanion export (binds manifest + tools)
├── types.ts               # Input + Artifact types
├── form.tsx               # Form component
├── pages/
│   ├── List.tsx           # List row
│   └── Detail.tsx         # Artifact renderer
└── server/
    └── tools.ts           # CompanionToolDefinition[] export
```

### 13b. Two-file registration

Every entity companion must be registered in both:

1. **`companions/index.ts`** — server-side registry (read by the host MCP server)

   ```ts
   import { prReviewer } from "./pr-reviewer/index.js";
   export const companions: RegisteredCompanion[] = [build, prReviewer /*, …alphabetical*/];
   ```

2. **`companions/client.ts`** — client-side registry (read by the React app)

   ```ts
   import PrReviewerDetail from "./pr-reviewer/pages/Detail";
   import PrReviewerListRow from "./pr-reviewer/pages/List";
   import PrReviewerForm from "./pr-reviewer/form";

   const artifactRenderers = { "pr-reviewer": PrReviewerDetail as ArtifactRenderer };
   const listRows = { "pr-reviewer": PrReviewerListRow as ListRow };
   const forms = { "pr-reviewer": PrReviewerForm as CompanionForm };
   ```

Missing either file = "No form registered" or "No tools" runtime errors. Both are mandatory.

### 13c. The `RegisteredCompanion` shape

```ts
export interface RegisteredCompanion {
  manifest: Manifest;
  tools: CompanionToolDefinition[];        // domain proxy tools only
  source?: "local" | "installed";          // local = on-disk; installed = npm package
}
```

Generic entity tools are auto-added by the host — companions only declare their domain tools.

### 13d. External dependencies

External libraries (SDKs, API clients) are declared based on whether the companion is local or installed.

**Local companions** (in `companions/<name>/`):

- Add their dependencies to the host's top-level `package.json`
- Examples: PR reviewer adds `@octokit/rest`, CloudWatch adds `@aws-sdk/client-cloudwatch-logs`, Linear adds `@linear/sdk`
- Reason: local companions are part of the host's build; they share the host's `node_modules`

**Installed companions** (npm package `claudepanion-<name>`):

- Declare dependencies in their own `package.json`
- Brought along automatically when the user runs `npm install claudepanion-<name>` (or via `claudepanion plugin install`)
- Reason: installed companions are independently published and consumed; they own their dependency tree

**Convention:** every companion's README lists its external dependencies and the credentials/config it needs. This makes evaluation easy when contributing back to the host or when a user is deciding whether to install a third-party companion.

---

## 14. Reliability

### 14a. Validator

`src/server/reliability/validator.ts` runs at companion register and on every reload:

- Manifest schema valid (name regex, kind enum, contractVersion match, semver, etc.)
- Required files present (`form.tsx`, `pages/List.tsx`, `pages/Detail.tsx`, `types.ts`, `server/tools.ts` for entity kind)
- Tool names prefixed with `<name>_`
- 🎯 `requiredEnv` declared if the companion's tools reference `process.env.*`

Validator issues are surfaced via `GET /api/reliability/<name>`. Fatal issues block the companion from registering; non-fatal issues become warnings on the About page.

### 14b. Smoke test

`src/server/reliability/smoke.ts` calls every domain tool with empty args and classifies the result:
- Resolved → ok
- Rejected with validation-shaped error → ok (the tool correctly rejected bad input)
- Rejected with `TypeError` / `ReferenceError` / `SyntaxError` → fail (code-level bug)

Smoke runs at register and on every reload. Used to catch typos and broken imports before a user hits them.

### 14c. Watcher

`src/server/reliability/watcher.ts` (chokidar) watches `companions/*/manifest.ts` and re-imports affected companions on change. No server restart needed for iteration. The companion needs `tsc` to have rebuilt to `dist/` — `npm run dev` runs `tsc --watch` in parallel.

---

## 15. Patterns & Conventions

### 15a. Naming

- **Slug** (`name`): `kebab-case`, regex `/^[a-z][a-z0-9-]*$/`. Examples: `pr-reviewer`, `cloudwatch-investigator`.
- **Camel binding** (used in code imports): `prReviewer`, `cloudwatchInvestigator`.
- **Pascal type** (used in interface/component names): `PrReviewerInput`, `CloudwatchInvestigatorArtifact`.
- **Tool prefix**: always `<slug>_`. e.g. `pr_reviewer_get_diff` (note: hyphens in the slug become underscores when used as a tool prefix because tool names can't contain hyphens — actually, double-check with the validator... see TODO).

### 15b. Error message format

Always `[<class>] <message>` for proxy tool errors. Plain message (no prefix) is treated as fatal generic error.

### 15c. Artifact `errors[]`

Always include this field on artifact types when the run does any optional work that could fail recoverably. Skill populates it from log warnings.

### 15d. Status messages

Short, human-readable, present tense. Examples:
- `"querying CloudWatch"`
- `"fetching PR diff"`
- `"posting review to GitHub"`
- `"writing report"`

Avoid technical noise: not `"step 4 of 7"`, not `"calling pr_reviewer_get_diff"`.

### 15e. Log messages

Same style as status, but past tense — they describe what just happened:
- `"Fetched PR #142 (47 files, +1240 / -380)"`
- `"Found 3 risky diffs"`
- `"Posted review to GitHub"`

Each `_append_log` should mark a meaningful step, not every tool call. The user is reading these to understand what Claude did.

### 15f. The skill is the program

If logic varies between companions, it lives in the skill. The proxy tools are stateless thin wrappers around external APIs; they don't decide policy. The skill decides:
- Order of operations
- When to retry
- What to do with results
- When to stop

This keeps proxy tools small and testable, and makes skill diffs the readable artifact when behavior changes.

---

## 16. Build's responsibilities

> **What Build must produce when given a description.**

The Scaffold Specification (§§1–15) describes what a finished companion must satisfy. This section describes what **Build** must *author* to satisfy it. The templates Build copies from `companions/build/templates/` are skeletons — Build is responsible for filling them in with real, working code. **Token substitution alone is not sufficient.** A companion that ships with an empty `server/tools.ts` and a placeholder `summary: string` artifact does not satisfy §§5, 9, or 11 — and Build is what's responsible for making it satisfy them.

This section is the contract `skills/build-companion/SKILL.md` is written against. If something below is missing from the skill, the skill is incomplete.

### 16a. Inputs to Build

Build receives a `BuildInput` from the form (`companions/build/types.ts`):

- `mode: "new-companion"` with `name`, `kind`, `description`, optional `example` slug, OR
- `mode: "iterate-companion"` with `target` slug + `description` of changes.

This section describes `new-companion` mode. Iterate mode is described in `skills/build-companion/SKILL.md`.

### 16b. Interpretation — translate description into a companion shape

Before writing any files, Build must read `entity.input.description` and decide five things:

1. **External system.** Which API will the companion talk to (GitHub, AWS, Linear, Slack, OpenAI, generic HTTP, etc.)? Default assumption: every companion has at least one proxy tool. A description that names no external system is the rare case and must be confirmed (per §16f.4).
2. **Read vs. write.** Does the description explicitly request actions that change external state ("post a review", "update an issue", "send a message", "create an alarm")? If yes, scaffold the requested write tools with `sideEffect: "write"`. If not, default to read-only per §9e.iv.
3. **Form fields (input shape).** What configuration does the user provide on each run that makes a general query specific? The form captures WHERE/WHICH — repo + PR number, AWS profile + log group + time range, Linear team + filter — not "paste the thing here."
4. **Artifact fields (output shape).** What domain fields does the user want the Detail page to render? At minimum `summary: string`. Domain fields make the artifact useful (e.g., for a PR reviewer: `prTitle`, `risks: string[]`, `questions: string[]`, `recommendation: "approve" | "request_changes" | "comment"`).
5. **Proxy tools.** What tool calls does the skill body need to perform the requested work? Each tool maps to one external API call.

### 16c. SDK / env-var lookup

| Service | Recommended SDK | Required env var | Notes |
|---|---|---|---|
| GitHub API | `@octokit/rest` | `GITHUB_TOKEN` | Personal access token, `repo` scope |
| AWS (any service) | `@aws-sdk/client-<service>` | (none) | Profile passed as tool arg, credentials from `~/.aws/credentials` |
| Linear API | `@linear/sdk` | `LINEAR_API_KEY` | Personal API key |
| Slack API | `@slack/web-api` | `SLACK_BOT_TOKEN` | Bot token starting with `xoxb-` |
| OpenAI API | `openai` | `OPENAI_API_KEY` | |
| Generic HTTP | built-in `fetch` | varies | Document required env vars in the manifest |

Build must declare the chosen env var(s) in `manifest.requiredEnv` so the preflight check (§4) works on first run.

### 16d. Files Build must author

For `kind: "entity"`, Build authors **real** contents for every file in §13a — not stub bodies, not commented-out examples.

| File | Build's authoring responsibility |
|---|---|
| `manifest.ts` | All fields populated. `requiredEnv` per §16c. `description` is one user-facing sentence. `icon` is one emoji that fits the domain. |
| `types.ts` | `<Pascal>Input` with the fields decided in §16b.3. `<Pascal>Artifact extends BaseArtifact` with the fields decided in §16b.4. Both JSON-serializable. |
| `form.tsx` | One input element per `<Pascal>Input` field with appropriate type (text, number, select, etc.), client-side validation, typed `onSubmit` payload. No "paste your text" textarea unless the description literally calls for it. |
| `pages/List.tsx` | Render a meaningful summary per row from input + artifact fields. Not just `entity.input.description`. |
| `pages/Detail.tsx` | Render the artifact's domain fields. The host wraps this in `<BaseArtifactPanel>` automatically — companion code only renders the domain middle. |
| `server/tools.ts` | Real `CompanionToolDefinition[]` exporting one tool per external API call identified in §16b.5. Each follows the §9d pattern: validate config → validate input → call API → classify error → return. Set `sideEffect: "write"` on writes. **Exporting an empty array when the description names an external system is a build failure** (§16f). |
| `index.ts` | Standard binding — `{ manifest, tools }`. |

For the skill body at `skills/<name>-companion/SKILL.md`, Build authors:

- A specific **Step 4 ("Do the work")** that calls each proxy tool in the right order, with `_append_log` calls between meaningful steps. The generic `__DESCRIPTION__` token from the template must be replaced with an actual sequence — not pasted in verbatim.
- A **write-permission stanza** (§9e.ii) for any write tool.
- The frontmatter, preflight, error handling, and continuation stanzas come from the template and should be left intact.

### 16e. Files Build must modify

| File | Modification |
|---|---|
| `package.json` (root) | Add the chosen SDK as a dependency. Run `npm install` after the edit so `tsc` and the watcher can resolve the import. |
| `companions/index.ts` | Insert the new companion's import and array entry, alphabetical by slug. |
| `companions/client.ts` (entity kind only) | Insert form, list, and detail registrations. |

### 16f. Self-check before commit

Before saving the artifact and marking the run complete, Build must verify:

1. **`server/tools.ts` exports at least one tool** when the description names an external system. Empty exports = call `_fail` with a message naming the missing tool surface and stop.
2. **`requiredEnv`** in the manifest matches the env vars actually referenced in `server/tools.ts` handlers.
3. **Each tool name** is prefixed with `<slug>_` (slug hyphens become underscores in tool names).
4. **Reliability snapshot** at `GET /api/reliability/<name>` reports `validator.ok === true` and `smoke.ok === true`.

If any check fails: `_fail` with a specific message naming the gap. The user can re-trigger Build with feedback rather than restarting from scratch — that's the iteration loop the slash-command architecture enables.

### 16g. What Build does NOT do

- Build does **not** run the new companion's skill. The user does that, separately, after Build completes.
- Build does **not** invent external systems not named in the description.
- Build does **not** add write tools when the description only requested read access (§9e.iv).
- Build does **not** edit files outside: `companions/<name>/`, `skills/<name>-companion/`, root `package.json`, `companions/index.ts`, and `companions/client.ts`.

### 16h. The bar Build must clear

A user types a paragraph describing the companion they want and a `requiredEnv` value (or has it pre-set). They paste one slash command into Claude Code. They wait. When Build completes, the new companion is live in the sidebar — manifest, types, form, list, detail, real proxy tools using the right SDK, skill body sequenced for those tools, dependency installed, registrations done, validator and smoke green.

If Build can't clear that bar reliably, the product is incomplete. Every gap surfaced when running Build against a real description is a defect in either this spec, the templates, or the Build skill — not a defect in the user's description.

---

## Implementation status

This spec describes the target. Current state vs. spec:

| Section | Status |
|---|---|
| 2. Lifecycle | ✅ Shipped |
| 3. Manifest (existing fields) | ✅ Shipped |
| 3. Manifest `requiredEnv`/`optionalEnv` | ✅ Shipped |
| 4. Configuration & preflight | ✅ Shipped (endpoint + banner) |
| 5. Form contract | ✅ Shipped (form + preflight banner integration) |
| 6. Entity | ✅ Shipped |
| 7. Skill template | ✅ Shipped (continuation + preflight + error handling + write-permission stanzas) |
| 7d. Continuation contract | ✅ Shipped (skill template stanza) |
| 8. Generic entity tools | ✅ Shipped (with proper Zod schemas after recent refactor) |
| 9. `CompanionToolDefinition` | ✅ Shipped |
| 9e. Write-action safety | ✅ Shipped (sideEffect flag + skill pattern + About warning) |
| 10. Error handling helpers | ✅ Shipped (configErrorResult/inputErrorResult/transientErrorResult) |
| 10. Skill error pattern | ✅ Shipped (template additions) |
| 10. Artifact `errors[]` convention | ✅ Shipped (BaseArtifact + BaseArtifactPanel) |
| 11. Artifact rendering | ✅ Shipped (BaseArtifactPanel wrapper) |
| 11.5. BaseArtifact interface | ✅ Shipped |
| 12. List & Detail pages | ✅ Shipped |
| 12c. About page (entity kind) | ✅ Shipped (CompanionAbout) |
| 13. Registration | ✅ Shipped |
| 13d. External dependencies | ✅ Convention documented (top-level for local, own pkg.json for installed) |
| 14. Validator / smoke / watcher | ✅ Shipped (validator may need `requiredEnv` rule) |

**Foundation shipped:** Phase 1–4 of `docs/superpowers/plans/2026-04-25-scaffold-foundation.md` complete.

**Remaining for chip examples:**

1. Build's first read-only proxy companion (e.g., GitHub PR reviewer) using the new primitives
2. End-to-end verification — scaffold a companion with `requiredEnv`, run preflight check, verify About page rendering, simulate a run with a recoverable error
