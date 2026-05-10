# Scaffold Consistency Redesign

> **Status:** Design approved 2026-05-09. Implementation plan to follow.
>
> **Audience:** Sean (the only contributor today). Future contributors after the redesign ships.
>
> **Spawned from:** a real `/build-companion` run on 2026-05-09 that scaffolded a `cloudwatch-investigator` and surfaced a long list of friction points. That companion was reverted; this spec is the redesign that absorbs the lessons.

---

## Summary

Today's `/build-companion` skill is 500 lines and produces drift between companion authoring runs because most of the work is mechanical-but-prose-driven. This redesign collapses the variation surface by:

1. **Schema-driven forms.** Every UI-kind companion declares its inputs as a Zod schema; the host renders the form from that schema. No more per-companion `form.tsx` in the common case.
2. **Markdown artifacts.** Every companion's run output is a single markdown blob rendered by a host-shipped panel. No more per-companion `Detail.tsx`. No more per-companion typed artifact contracts that have to stay in sync with their JSX consumers.
3. **A `claudepanion scaffold` CLI** that handles all mechanical scaffolding work (registration, build, remount, self-check) deterministically. The build skill's authoring step shrinks to four files of substance.
4. **A `defineTool()` helper** that fixes the `CompanionToolDefinition[]` typing footgun.
5. **A real watcher fix** so dev-mode hot-reload stops failing silently.
6. **Renamed kinds:** `kind: "entity"` → `kind: "ui"`. Clearer, less jargony.
7. **Data moves to `~/.claudepanion/data/`** so multiple cwds don't fragment user state.

After this, the build skill is ~150 lines, every companion has the same predictable shape, and the work Claude does per build is mostly creative-only (interpret the description, author the schema, author the proxy tools, author the playbook).

---

## What's a companion?

A companion is a small app that lives inside the claudepanion host. There are two kinds.

### UI-kind companion (`kind: "ui"`)

A lifecycle-driven companion with a form, a run, and an artifact. Made up of:

- **A manifest** (`manifest.ts`) — declares slug, kind, display name, icon, contract version, semantic version. The host's handshake.
- **An input schema** (`types.ts`, exported as `InputSchema`) — a Zod schema describing the form's inputs, with `.meta({ ui: ... })` hints for dropdowns, groups, and field types. Drives auto-rendered forms.
- **A markdown artifact contract** — every run produces a `BaseArtifact` (`{ summary, markdown, errors? }`) plus optional `ArtifactExtras` (typed fields for list-row badges, search, future programmatic use). The markdown is the canonical user-facing report.
- **Proxy tools** (`server/tools.ts`) — MCP tools the skill calls during execution and the form calls for `optionsFrom` dropdowns. Authored with `defineTool({...})`.
- **A skill body** (`skills/<slug>-companion/SKILL.md`) — the playbook Claude follows when the slash command fires. Mostly a host-canonical template; the freeform parts are the description frontmatter and the "Step 4 — Do the work" sequence of proxy-tool calls.
- **Optional override files** — `form.tsx`, `pages/Detail.tsx`, `pages/List.tsx`. Drop one in to replace the default host primitive for that surface. Filesystem-presence is the contract.
- **Lifecycle state** — entity JSON files in `~/.claudepanion/data/<slug>/<id>.json`, managed by the host. Form submission creates an entity; the skill transitions it from `pending` → `running` → `completed`/`error` and saves the artifact.

The host renders three pages for every UI companion: the **Form page** (auto-generated from `InputSchema`), the **List page** (one row per past run, default `<DefaultListRow>`), and the **Detail page** (default `<MarkdownArtifactPanel>`).

### Tool-kind companion (`kind: "tool"`)

An MCP-only companion. No form, no list, no artifact, no lifecycle. Made up of:

- **A manifest** (`manifest.ts`) — same shape as UI-kind but with `kind: "tool"`.
- **Proxy tools** (`server/tools.ts`) — the entire point of this kind. The MCP server exposes them; Claude calls them directly during a session.
- **A skill body** (`skills/<slug>-companion/SKILL.md`) — typically a brief "use these tools when X" guide rather than a step-by-step playbook. Optional, but recommended so Claude knows when the tools are relevant.

The host renders one page for every tool companion: the **About page**, an auto-generated reference of available tools and their parameters.

### What's auto-generated

For both kinds, these files are emitted by `claudepanion scaffold` (deterministic, regenerated on every run):

- `companions/<slug>/index.ts` — the exports binding manifest + tools.
- `companions/index.ts` — the host registry array (alphabetical-by-slug).
- `companions/client.ts` — the browser dispatch table for forms / list rows / detail panels (registers overrides where present, defaults otherwise).

These stay tracked in git so a fresh `git clone && npm install && npm run build` works without first running the CLI. Manual edits are flagged in PR review by the `// AUTO-GENERATED` banner.

---

## Background — the build experience this fixes

The 2026-05-09 build run hit eleven distinct friction points, of which the load-bearing ones were:

- **The watcher race.** Source files were written before `tsc --watch` had compiled them; the chokidar watcher fired, the reimport tried to load `dist/.../index.js`, found it missing, and silently failed. `build_self_check` then returned `[input] companion not registered`. Recovery required manually `touch`ing the manifest after the build.
- **Form-talks-to-tools is undocumented.** The user explicitly asked for live AWS-backed dropdowns. The skill's §16 implies `server/tools.ts` is MCP-only. Implementing dropdowns required discovering that `/api/tools/:companion/:tool` exists, finding it was gated to `kind: "tool"`, and patching the gate. Nothing in the skill or contract said this was the path.
- **Typing footgun.** `CompanionToolDefinition[]` defaults each entry's handler `params` to `Record<string, unknown>`. The skill's example didn't compile as written; refactor required.
- **AWS credential default was wrong.** The skill's SDK guidance mentioned `~/.aws/credentials`; the user immediately wanted env-var auth too. `fromNodeProviderChain` handles both transparently.
- **Two-file registration was easy to forget.** `companions/index.ts` and `companions/client.ts` are mechanical edits with no compile-time check that they're in sync.

The full list is captured in the brainstorm conversation; the redesign here addresses each one structurally.

---

## Design decisions

Decisions made during the brainstorm, with the alternatives we considered.

| Decision | Choice | Rejected alternatives | Why |
|---|---|---|---|
| Scope | One consolidated design | Skill-prose-only; host-primitives-only; rename-only | The pieces interact (form primitives reshape the manifest schema; CLI's existence shrinks the skill) and shipping them in isolation creates intermediate inconsistent states. |
| Kind naming | `ui` + `tool` | `workflow` + `tool`; `interactive` + `tool`; keep `entity` | Most immediately understandable to a first-time reader. |
| Form authoring | Schema-driven with override slots | Composition primitives only; hand-rolled with docs | Forms are a small palette (text/select/datetime/dropdown). Schema-driven gives consistency *and* shrinks Claude's authoring surface. Override slot preserves flexibility when needed. |
| Mechanical scaffolding | `claudepanion scaffold` CLI | Skill prose only; inline generators in the skill | Mechanical work shouldn't live in prose Claude reads. CLI gives deterministic results, structured errors, and shrinks the skill. |
| Artifact rendering | Markdown only (no per-companion Detail.tsx) | Composition primitives; schema-driven artifact display | Artifacts vary too much for schema-driven. Markdown plays directly to Claude's strengths and removes an entire category of authoring. |
| List rows | Default host component, override possible | Required hand-rolled per companion | 90% of list rows are status + summary + timestamp. Default it; override the rare exception. |
| Error classifiers | Pattern taught in skill, not host-shipped | Host-shipped per-service classifiers | Host's surface stays minimal. Pattern is small enough that copy-paste between companions is fine. |
| Credential helpers | Pattern taught in skill, not host-shipped | Host-shipped helpers like `defaultAwsCredentials()` | Same reasoning. |
| User state location | `~/.claudepanion/data/` + `~/.claudepanion/cache/` | `data/` in cwd; full user-local install | Decouples user state from cwd without committing to the bigger packaging redesign. The bigger design is captured in a separate Notion page (linked below) for later. |
| Migration tooling | None — hand-migrate Build | `claudepanion migrate <slug>` CLI | One companion to migrate, one user. The migration story can be designed when there are more companions in flight. |

The full user-local install model (publish your personal companions to your own GitHub repo, framework as `npm install -g claudepanion`) is captured in [User-local install (deferred design)](https://www.notion.so/35c71f4cdd628194a208c9191d37e767) and is not in scope here.

---

## The new companion shape

### UI-kind companion files

```
companions/<slug>/
├── manifest.ts          ← Claude authors  (~20 lines)
├── types.ts             ← Claude authors  (~30 lines: InputSchema + optional ArtifactExtras)
├── index.ts             ← CLI generates   (3 lines, deterministic)
└── server/
    └── tools.ts         ← Claude authors  (variable; one defineTool() per API call)

skills/<slug>-companion/
└── SKILL.md             ← Claude authors  (~100–200 lines, the playbook)
```

**Five files. Three with creative content. No `form.tsx`, `Detail.tsx`, `List.tsx` in the common case** — those are rendered by host-shipped primitives reading from `manifest`, `types.InputSchema`, and `artifact.markdown`.

### Tool-kind companion files

```
companions/<slug>/
├── manifest.ts
├── index.ts             ← CLI generates
└── server/
    └── tools.ts

skills/<slug>-companion/
└── SKILL.md
```

No `types.ts` because there's no input/artifact lifecycle.

### `types.ts` (UI-kind canonical example)

```ts
import { z } from "zod";
import type { BaseArtifact } from "../../src/shared/types.js";

export const InputSchema = z.object({
  profile: z.string().optional().describe("AWS profile"),
  region: z.string().min(1).describe("AWS region"),
  alarmName: z.string().min(1).describe("Alarm")
    .meta({ ui: { kind: "select", optionsFrom: "list_alarms_in_alarm", argsFrom: ["region"] } }),
  logGroup: z.string().min(1).describe("Log group")
    .meta({ ui: { kind: "searchableSelect", optionsFrom: "list_log_groups", argsFrom: ["region"] } }),
  startTime: z.string().datetime().meta({ ui: { kind: "datetime", group: "time-window" } }),
  endTime:   z.string().datetime().meta({ ui: { kind: "datetime", group: "time-window" } }),
  filter: z.string().optional().describe("CloudWatch Logs filter pattern"),
});

export type Input = z.infer<typeof InputSchema>;

// Optional. Typed fields beyond markdown — for list-row badges, future filtering/search.
// Rendering is always artifact.markdown; these fields are NOT for displaying.
export interface ArtifactExtras {
  alarmName: string;
  eventCount: number;
}

export type Artifact = BaseArtifact & ArtifactExtras;
```

Default for companions that don't need extras: `export type Artifact = BaseArtifact;`.

### `manifest.ts`

```ts
import type { Manifest } from "../../src/shared/types.js";

export const manifest: Manifest = {
  name: "cloudwatch-investigator",
  kind: "ui",                          // was "entity"
  displayName: "Cloudwatch Investigator",
  icon: "🔎",
  description: "Investigate AWS CloudWatch logs for an alarm…",
  contractVersion: "2",                // bumped from "1"
  version: "0.3.0",
};
```

### Override slots

```
companions/<slug>/form.tsx              // override <CompanionForm> for custom UX
companions/<slug>/pages/Detail.tsx      // override <MarkdownArtifactPanel>
companions/<slug>/pages/List.tsx        // override <DefaultListRow>
```

Resolver: presence-on-disk wins. Host falls back to the primitive when the override file is absent. No flag in the manifest; filesystem is the contract.

---

## Host primitives

These are new components/helpers shipped by the host. Each removes a class of work from per-companion authoring.

### `<CompanionForm schema={InputSchema} onSubmit={...} />`

Lives at `src/client/primitives/CompanionForm.tsx`. Replaces every per-companion `form.tsx` in the default case.

```ts
function CompanionForm<T extends z.ZodTypeAny>({
  schema: T,
  onSubmit: (input: z.infer<T>) => void | Promise<void>,
  companionSlug?: string,
}): JSX.Element
```

**Field rendering** is driven by `schema.shape[fieldName].meta()?.ui ?? inferred-default`:

| Schema | Default UI | `meta({ ui })` overrides |
|---|---|---|
| `z.string()` | `<input type="text">` | `kind: "select"` (with `options: [...]` or `optionsFrom: "tool"`); `kind: "searchableSelect"`; `kind: "textarea"`; `kind: "password"` |
| `z.string().datetime()` | `<input type="datetime-local">` | — |
| `z.number()` | `<input type="number">` | `kind: "slider"` with min/max/step |
| `z.boolean()` | `<input type="checkbox">` | — |
| `z.enum([...])` | `<select>` of enum values | — |

**`optionsFrom` semantics.** When a field declares `optionsFrom: "tool_name"`, the form POSTs to `/api/tools/<companionSlug>/<tool_name>` to populate the dropdown. The body's `args` come from any fields the schema names in `argsFrom: [...]` plus prefilled defaults. The form maintains a dependency graph: when an `argsFrom` field changes, the dropdown refetches.

The form handles loading state, retry on transport failure, and the standard `[config]` / `[input]` / `[transient]` prefix rendering — failures show the message inline with a Retry button.

**`group` semantics.** Fields sharing a `group` value render side-by-side in a labeled row. Removes the "datetime range" custom layout from per-companion code.

**Validation.** Per-field on blur (Zod parse on the field). On submit, full schema parse via `safeParse`; first error scrolls into view. Submit button disabled while required fields are invalid.

### `<MarkdownArtifactPanel artifact={artifact} />`

Lives at `src/client/primitives/MarkdownArtifactPanel.tsx`. Replaces every per-companion `pages/Detail.tsx` in the default case.

```ts
function MarkdownArtifactPanel({ artifact: BaseArtifact }): JSX.Element
```

Renders:

```
┌──────────────────────────────────────────────────────┐
│  {artifact.summary}                                  │  ← page header (h1)
├──────────────────────────────────────────────────────┤
│  ⚠ Notes during this run                            │  ← only if errors[] non-empty
│  • <error 1>                                         │
├──────────────────────────────────────────────────────┤
│                                                      │
│  <react-markdown>{artifact.markdown}</react-markdown>│
│                                                      │
└──────────────────────────────────────────────────────┘
```

Uses `react-markdown` (already a dep). GFM enabled (tables, strikethrough, task lists). Sanitized — no raw HTML in artifact markdown. Empty markdown → placeholder ("No markdown report generated").

### `<DefaultListRow entity={entity} />`

Lives at `src/client/primitives/DefaultListRow.tsx`. Replaces every per-companion `pages/List.tsx` in the default case.

```ts
function DefaultListRow({ entity: Entity<unknown, BaseArtifact> }): JSX.Element
```

Renders: `[status pill] {entity.id}  {artifact.summary ?? "<pending>"}  {relativeTime(entity.updatedAt)}`.

### `defineTool()` helper

Lives at `src/shared/define-tool.ts`. Fixes the `CompanionToolDefinition[]` typing footgun.

```ts
export function defineTool<S extends z.ZodRawShape>(def: {
  name: string;
  description: string;
  schema: S;
  sideEffect?: "read" | "write";
  handler: (params: z.infer<z.ZodObject<S>>) => Promise<McpToolResult>;
}): CompanionToolDefinition;
```

Generic flows from `schema` to `handler.params` automatically. Authoring:

```ts
export const tools = [
  defineTool({
    name: "cloudwatch_investigator_list_log_groups",
    description: "List CloudWatch Logs log groups…",
    schema: {
      profile: z.string().optional().describe("AWS profile"),
      region: z.string().min(1).describe("AWS region"),
    },
    async handler({ profile, region }) {
      // profile: string | undefined, region: string — types inferred
      ...
    },
  }),
];
```

No manual `<CompanionToolDefinition<{...}>>` typing per tool, no `as unknown as ...` casts.

### `BaseArtifact` shape change

```ts
// before
interface BaseArtifact {
  summary?: string;
  errors?: string[];
}

// after
interface BaseArtifact {
  summary: string;       // required: list-row + Detail header
  markdown: string;      // required: the canonical user-facing report
  errors?: string[];
}
```

---

## The new build skill flow

The skill goes from 500 lines to ~150. Per-step responsibilities:

```
1. Load entity                  ← mcp__claudepanion__build_get
2. Validate + interpret          ← creative: kind, schema, tools, SDK
3. Echo interpretation, pause    ← user-redirect checkpoint (~5s)
4. Mark running                  ← mcp__claudepanion__build_update_status
5. Author 4 files                ← creative: manifest, types, server/tools, SKILL.md
6. Add SDK to package.json       ← if needed
7. Run claudepanion scaffold     ← MECHANICAL: CLI does the rest
8. Branch on CLI result          ← if !ok, build_fail with the actionable message
9. Commit
10. Save artifact + complete     ← markdown summary of what was built
```

### Step 5 (the authoring step)

Four file authorings, each with a tight contract:

**5a — `manifest.ts`** (~15 lines, near-verbatim template).

**5b — `types.ts`** — author `InputSchema` as `z.object({...})` (or `z.discriminatedUnion(...)` for special cases like Build itself). Use `.describe()` for field labels. Use `.meta({ ui: ... })` for dropdowns and groups. Default `Artifact = BaseArtifact;` unless typed extras are needed.

**5c — `server/tools.ts`** — use `defineTool({...})` for every entry. Author an inline error classifier following the canonical pattern (see worked example below). Return `successResult(data)` on success; classified errors otherwise.

**5d — `SKILL.md`** — the playbook for THIS companion's tools. Most of the file is a template the build skill embeds verbatim; only the description frontmatter, the Step 4 playbook, and any write-tool permission stanzas are freeform.

### SDK guidance table

The skill embeds this table for choosing dependencies and credential helpers:

| External system | SDK | Credential default |
|---|---|---|
| AWS | `@aws-sdk/client-<service>` | `fromNodeProviderChain({ profile })` from `@aws-sdk/credential-providers` |
| GitHub | `@octokit/rest` | env `GITHUB_TOKEN` (PAT, `repo` scope) |
| Linear | `@linear/sdk` | env `LINEAR_API_KEY` |
| Slack | `@slack/web-api` | env `SLACK_BOT_TOKEN` |
| OpenAI | `openai` | env `OPENAI_API_KEY` |
| Generic HTTP | built-in `fetch` | varies — document required env in manifest |

The skill's worked example shows two complete error classifiers (one for AWS, one for GitHub) using the `[config]` / `[input]` / `[transient]` taxonomy. For other services, Claude extrapolates: auth/permission errors → `[config]`, bad-input/not-found errors → `[input]`, rate-limit/5xx errors → `[transient]`, partial-success errors → `[recoverable]`. The taxonomy is the contract; the per-service mapping is a copy-paste pattern.

### Worked example embedded in the skill

A full PR-reviewer scaffold from description → schema → tools → skill → CLI run → commit. Different domain from CloudWatch (covers GitHub + write tool + user-permission stanza). Real authored content, not abstract placeholders.

### Common Mistakes (split by severity)

**STOP — do not proceed:**
- About to curl `/api/entities/*` to mutate state
- About to write directly to `data/**/*.json`
- About to leave `<<<INSERT PLAYBOOK HERE>>>` in the SKILL.md
- About to mark `completed` without running scaffold's self-check

**Hygiene — fix before commit:**
- `git add` missed `package.json` after dependency change
- Skill description is generic ("Helps with X") instead of specific
- ArtifactExtras has fields that don't appear in any list row override (delete them)

### Iterate-mode sub-flow

Same skill, condensed:

```
1. Load entity, validate (target ≠ "build")
2. Read current source under companions/<target>/
3. Mark running
4. Apply requested changes
5. Bump version (patch/minor/major heuristic)
6. Run claudepanion scaffold <target>     ← brings everything in sync
7. Branch on result
8. Commit
9. Save artifact + complete
```

---

## The scaffold CLI

Lives at `src/cli/` (entry from `bin/cli.js`).

### Subcommands

```
claudepanion scaffold <slug>     # bring slug's files into a coherent registered state
claudepanion regenerate          # re-derive registry files from disk
claudepanion remount <slug>      # signal the running server to remount slug
```

### `scaffold <slug>` contract

**Reads:**
- `companions/<slug>/manifest.ts` — required.
- `companions/<slug>/types.ts` — required for `kind: "ui"`, optional for `kind: "tool"`.
- `companions/<slug>/server/tools.ts` — optional.
- `package.json` — for dependency-presence check.
- `skills/<slug>-companion/SKILL.md` — required, frontmatter validated.

**Steps:**

1. Validate slug regex `^[a-z][a-z0-9-]*$`. Reject `"build"` if creating new.
2. Read & validate manifest (type, version, kind).
3. Read tools.ts; verify each tool's name is prefixed with `<slug>` (hyphens→underscores) and side-effects are declared.
4. Walk `tools.ts` AST imports; npm install missing non-relative imports.
5. Generate `companions/<slug>/index.ts` (deterministic exports binding).
6. Regenerate `companions/index.ts` (glob `companions/*/manifest.ts` alphabetically).
7. Regenerate `companions/client.ts` (glob for override files; register defaults otherwise).
8. Run `npm run build`. Pipe stderr on failure.
9. POST `/api/internal/remount?slug=<slug>` to running server (default port 3001). Server-down is non-fatal — log warning.
10. Run validator + smoke-runner in-process (bypassing MCP).
11. Emit JSON to stdout.

### Output

**Success:**
```json
{
  "ok": true,
  "slug": "cloudwatch-investigator",
  "kind": "ui",
  "stagesRun": ["validate", "deps", "codegen", "build", "remount", "self-check"],
  "filesGenerated": ["companions/cloudwatch-investigator/index.ts", "companions/index.ts", "companions/client.ts"],
  "dependenciesAdded": ["@aws-sdk/client-cloudwatch@^3.700.0", "..."],
  "selfCheck": { "validator": { "ok": true }, "smoke": { "ok": true } }
}
```

**Failure (Claude branches on `stage`):**
```json
{
  "ok": false,
  "stage": "build",
  "error": "tsc failed: companions/.../tools.ts(42,7): error TS2322: ...",
  "remediation": "fix the type error in tools.ts and re-run scaffold"
}
```

| Stage | Cause | Skill remediation |
|---|---|---|
| `validate` | bad slug, manifest mismatch, missing required file | fix the named file; re-run |
| `deps` | npm install failed | check package name / network; re-run |
| `codegen` | filesystem error writing registry files | check permissions; re-run |
| `build` | tsc/vite failed | fix the named file; re-run |
| `remount` | server unreachable | check `claudepanion serve`; re-run |
| `self-check` | validator fatal or smoke shape error | read issues; fix file; re-run |

### Auto-registered files

`companions/index.ts` and `companions/client.ts` get a banner:

```ts
// AUTO-GENERATED — do not edit; run `claudepanion scaffold <slug>` or `claudepanion regenerate`.
```

They stay tracked in git so a fresh `git clone && npm install && npm run build` works without first running the CLI. Manual edits during PR review are visible flags.

### `/api/internal/remount` endpoint

```
POST /api/internal/remount?slug=<slug>
```

Re-imports `dist/companions/<slug>/index.js` with cache busting (mtime-keyed). Validates via the existing reliability validator. On success, `registry.remount(fresh)`; returns `{ ok: true, version }`. On failure, returns 4xx with the issue. Localhost-only.

---

## Watcher fix

`src/server/reliability/watcher.ts` gets three concrete changes:

1. **Dist-mtime gate.** Before `import()`, stat both source and `dist/` paths. If `dist.mtime < source.mtime`, throw `DistStaleError`. The watcher's `doRemount` catches and reschedules a debounced retry (max 3 attempts at 1s/2s/4s).
2. **`dev:tsc` health probe.** On server start, check `dist/.tsbuildinfo` recency. Log a clear warning if stale: `"tsc --watch isn't running; companion changes won't be picked up. Run npm run dev:tsc."`
3. **Structured failure logs.** `[watcher] could not re-import <slug>` becomes `[watcher] <slug> remount failed at <stage>: <reason> (will retry: yes/no)`. Stages: `dist-stale`, `import-threw`, `validation-failed`, `not-a-companion-module`.

The watcher never silently keeps the old version. Every failure path logs why.

---

## Server changes

| File | Change |
|---|---|
| `src/shared/types.ts` | `kind: "ui" | "tool"` (was `"entity" | "tool"`); `BaseArtifact` requires `summary` + `markdown`; export `defineTool()` |
| `src/server/companion-registry.ts` | `SUPPORTED_CONTRACT_VERSION = "2"` |
| `src/server/reliability/validator.ts` | Update kind checks; require `markdown` + `summary`; validate `InputSchema` is `z.ZodObject` or `z.ZodDiscriminatedUnion` |
| `src/server/reliability/watcher.ts` | Dist-mtime gate, retries, `dev:tsc` probe, structured logs |
| `src/server/api-routes.ts` | Drop `kind === "tool"` restriction on `POST /api/tools/:companion/:tool` for read tools; add `POST /api/internal/remount` |
| `src/server/index.ts` | Resolve `data/` and `cache/` from `~/.claudepanion/` via `os.homedir()`; create on first run |
| `src/cli/scaffold.ts` (new) | CLI implementation |
| `src/cli/regenerate.ts` (new) | Re-derive registry files |
| `bin/cli.js` | Wire new subcommands |

---

## Migration

Today on `main`: only `companions/build/` exists. The migration is for that one companion.

### Build companion changes

| Today | After |
|---|---|
| `kind: "entity"` | `kind: "ui"` |
| `contractVersion: "1"` | `contractVersion: "2"` |
| `BuildInput` discriminated-union TS interface | `InputSchema = z.discriminatedUnion("mode", [...])` in `types.ts` |
| `BuildArtifact` (typed: filesCreated[], filesModified[], validatorPassed, smokeTestPassed) | `BaseArtifact & ArtifactExtras` where extras are `{ validatorPassed, smokeTestPassed }` for badges |
| `form.tsx` (~150 lines) | **Stays as override** — the new/iterate tab UI is custom enough to justify it |
| `pages/Detail.tsx` | **Deleted** — `<MarkdownArtifactPanel>` takes over |
| `pages/List.tsx` | **Deleted** — `<DefaultListRow>` takes over |
| `index.ts` | Re-emitted by scaffold CLI |
| `companions/index.ts` + `client.ts` | Re-emitted by scaffold CLI |
| `server/tools.ts` (empty array) | Stays empty (but registered via `defineTool` for future use) |
| `templates/skill.md`, `templates/entity/`, `templates/tool/` | **Deleted** — token substitution goes away; worked example lives in the new skill |
| `skills/build-companion/SKILL.md` (~500 lines) | Rewritten to ~150 lines |
| `data/build/*.json` | **Deleted** — no users, no history to preserve |

### Build's markdown artifact (canonical example)

```markdown
## Built `cloudwatch-investigator`

Read-only AWS CloudWatch investigator. Uses `@aws-sdk/client-cloudwatch` and
`@aws-sdk/client-cloudwatch-logs` with credentials from the configured profile
or `AWS_*` environment variables.

**Tools:** `list_log_groups`, `list_alarms_in_alarm`, `describe_alarm`, `query_logs`

### Files created
- `companions/cloudwatch-investigator/manifest.ts`
- `companions/cloudwatch-investigator/types.ts`
- `companions/cloudwatch-investigator/server/tools.ts`
- `skills/cloudwatch-investigator-companion/SKILL.md`

### Files modified
- `companions/index.ts` (auto-regenerated)
- `companions/client.ts` (auto-regenerated)
- `package.json` — added 3 AWS SDK dependencies

### Validation
- ✓ validator
- ✓ smoke test (4 tools)

### Next step
Start a new Claude Code session in this repo to pick up the new skill, then paste:

`/cloudwatch-investigator-companion <new-entity-id>`
```

### What's NOT migrated

- Existing `data/build/*.json` entities — deleted, no users.
- The `entity` term in old commits / docs — code uses `ui`; commit messages stay as historical record; comments and docs get updated where touched.

---

## Error handling

The `[config]` / `[input]` / `[transient]` / `[recoverable]` prefix system in `src/shared/types.ts` carries forward unchanged. The build skill teaches Claude this canonical table:

| Prefix | Meaning | Skill action |
|---|---|---|
| `[config]` | Missing/expired credentials, missing IAM permission, missing env var | Call `_fail`; stop. User must fix env. |
| `[input]` | Bad ID, bad timestamp, malformed user input | Call `_fail`; stop. User must fix the form. |
| `[transient]` | Rate limit, network blip, 5xx upstream | Log warn, retry once, fail if still failing |
| `[recoverable]` | Partial success, one record failed but others worked | Log warn, add to `artifact.errors[]`, continue |
| (no prefix) | Unrecognized fatal | Treat as fatal; call `_fail` |

`<CompanionForm>` renders these prefix-prefixed messages inline at the failing field; the substantive part is human-readable.

`<MarkdownArtifactPanel>` always shows `errors[]` as a "Notes during this run" callout above the markdown.

The watcher never silently keeps an old version; every failure path logs the reason.

---

## Testing strategy

### Unit tests (vitest + Testing Library)

- `src/client/primitives/__tests__/CompanionForm.test.tsx` — field rendering, required vs optional, validation errors, `optionsFrom` with mocked fetch, `argsFrom` refetch on upstream change.
- `src/client/primitives/__tests__/MarkdownArtifactPanel.test.tsx` — summary + markdown render, errors[] callout, empty placeholder.
- `src/client/primitives/__tests__/DefaultListRow.test.tsx` — pill, summary, fallback to "<pending>".
- `src/shared/__tests__/define-tool.test.ts` — type inference + schema validation.

### Integration tests

- `src/cli/__tests__/scaffold.test.ts` — runs CLI against a temp directory; verifies registry generation, dep detection (mocked npm), build/remount/self-check stages, idempotence.
- `src/cli/__tests__/regenerate.test.ts` — re-derive idempotent.

### Watcher tests

- `src/server/reliability/__tests__/watcher.test.ts` — dist-mtime gate, retry exhaustion, `dev:tsc` probe warning, module-without-manifest error.

### Manual dogfood test (Phase 7 verification gate)

1. `git checkout main && npm install && npm run build`
2. `claudepanion serve`
3. Fill out Build form to scaffold `cloudwatch-investigator` with the same description used on 2026-05-09.
4. Paste slash command in a Claude Code session, run the build skill end-to-end.
5. Verify: companion exists; primitives rendered the form; scaffold CLI succeeded; self-check passed; new skill registered.
6. Use `/cloudwatch-investigator-companion <new-id>` against a real AWS account.
7. Verify: artifact renders as markdown; list row shows event-count + summary; proxy tools work.

Success bar:
- No watcher race surfaced.
- No typing footgun.
- No undocumented transport question.
- No "I had to discover this by reading host code."
- Resulting cloudwatch-investigator companion has 5 authored files plus auto-generated ones.

---

## Phasing

```
   ┌─────────┐   ┌─────────┐
   │ Phase 1 │ ──│ Phase 2 │ ───┐
   └─────────┘   └─────────┘    │
        │                       ▼
        ▼                  ┌─────────┐
   ┌─────────┐             │ Phase 4 │
   │ Phase 3 │ ────────────└─────────┘
   └─────────┘                  │
        │                       │
        ▼                       │
   ┌─────────┐                  │
   │ Phase 5 │                  │
   └─────────┘                  │
        │                       │
        ▼                       │
   ┌─────────┐                  │
   │ Phase 6 │ ◄────────────────┘
   └─────────┘
        │
        ▼
   ┌─────────┐
   │ Phase 7 │
   └─────────┘
```

| Phase | Ships | Verification |
|---|---|---|
| 1 — Type contract | Updated shared types + validator + `defineTool` helper | `npm run check` + `npm run test`; build companion fails validation as expected (gates Phase 5) |
| 2 — Server | Transport relaxation; `/api/internal/remount`; `~/.claudepanion/` data dir; watcher fix | Manual: edit a manifest, observe clean remount; stop tsc, observe warning; hit remount endpoint directly |
| 3 — Primitives | `<CompanionForm>`, `<MarkdownArtifactPanel>`, `<DefaultListRow>` | Vitest |
| 4 — Scaffold CLI | `scaffold`, `regenerate`, `remount` subcommands; auto-generated registry files | Integration tests; idempotent re-run |
| 5 — Build migration | Build companion on the new contract | `claudepanion serve` starts; About + form render; first run produces a markdown artifact |
| 6 — Build skill rewrite | New ~150-line skill + worked example + SDK guidance + `docs/scaffold-spec.md` rewrite | Read cold; no references to removed concepts |
| 7 — Dogfood | (no code) | Manual end-to-end test from clean repo to working `cloudwatch-investigator` |

Phases 1, 2, 3 can land in parallel. Phase 4 needs all three. Phase 5 needs 1 + 3 + 4. Phase 6 can be drafted in parallel with 5 but verified after. Phase 7 verifies 5 + 6 together.

---

## Out of scope / future work

- **Full user-local install (Option B from the brainstorm).** Capturing the framework as `npm install -g claudepanion` + `~/.claudepanion/` as a Node project + the dotfiles-style "publish your personal companions to your own GitHub repo" extension. Tracked in [User-local install (deferred design)](https://www.notion.so/35c71f4cdd628194a208c9191d37e767).
- **`claudepanion migrate <slug>` CLI subcommand.** Not needed today (one user, one companion to migrate). Add when there's a community or v2→v3 contract bump in flight.
- **Test-the-agent pattern** (running Claude over fixture descriptions and diffing interpreted outputs). Useful for skill regression testing; needs its own design pass.
- **Companion deletion ergonomics** (per existing followups doc) — independent of this work.
- **Cross-companion composition** (per existing followups doc) — independent of this work.

---

## Spec dependencies

- Existing: `docs/scaffold-spec.md` (will be rewritten in Phase 6 to reflect this design).
- Existing: `docs/concept.md` (mostly untouched; ten-elements list may add or restructure a couple bullets to match the new model).
- Existing: `docs/followups.md` — entries unrelated to this work stay; the watcher entry can be removed once Phase 2 ships.

---

## Glossary

- **UI-kind companion** (was: entity-kind) — has form + lifecycle + artifact. Default kind for most companions.
- **Tool-kind companion** — MCP tools only, auto About page, no form, no artifact, no lifecycle.
- **Override slot** — a per-companion JSX file (form.tsx / Detail.tsx / List.tsx) that replaces the default host primitive on a per-file basis.
- **`InputSchema`** — the Zod schema in `types.ts` describing the form's inputs. Must be a `z.ZodObject` or `z.ZodDiscriminatedUnion`.
- **`ArtifactExtras`** — optional typed fields beyond `BaseArtifact`. Not for rendering — for list-row badges, search/filter, future programmatic use.
- **`defineTool()`** — host helper for declaring a companion's MCP tool with type inference flowing from schema to handler.
- **Scaffold CLI** — `claudepanion scaffold` and friends. Replaces the manual file-edit-build-remount dance.
- **Dogfood test** — manual end-to-end verification that the build skill produces a working companion against a real external system.
