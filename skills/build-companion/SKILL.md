---
name: build-companion
description: Use when the user pastes "/build-companion <entity-id>" — scaffolds a new companion or iterates on an existing one for claudepanion.
---

# /build-companion <entity-id>

Claudepanion's built-in companion that scaffolds or iterates on other companions.

> **CRITICAL — MCP tools ONLY:**
> - ALL state changes (status, logs, artifact, failure) go through the tools prefixed `mcp__claudepanion__`.
> - NEVER curl the REST API at `/api/entities/*` to mutate state.
> - NEVER edit `data/build/<id>.json` directly.
> - If an MCP tool returns an error, call `mcp__claudepanion__build_fail` with the error and stop. Do NOT fall back to HTTP.
> - If MCP tools are unavailable in your session, STOP and tell the user: *"MCP tools from claudepanion are not loaded — verify `claudepanion plugin install` and that the server is running, then start a new Claude Code session."* Do not proceed.

> **Server base URL is `http://localhost:3001`.** Reliability snapshots at `/api/reliability/<name>` are read-only — reading them via Bash curl is allowed as a last resort for verification. Writing anything over REST is NOT.

## Step 1 — Load the Build entity

```
mcp__claudepanion__build_get({ id: "<entity-id>" })
```

Read `entity.input.mode`. Branch:

- `"new-companion"` → go to **Mode: new-companion** below.
- `"iterate-companion"` → go to **Mode: iterate-companion** below.

---

## Mode: new-companion

### Step 2 — Validate + resolve substitution tokens

`entity.input` has `name`, `kind`, `description`, and optionally `example` (a chip slug). Reject if:

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

### Step 3 — Mark running

```
mcp__claudepanion__build_update_status({ id: "<entity-id>", status: "running", statusMessage: "scaffolding files" })
```

### Step 4 — Scaffold files from templates

For `kind: "entity"`, read each source template, substitute tokens (every occurrence of `__NAME__`, `__CAMEL__`, `__PASCAL__`, `__DISPLAY__`, `__ICON__`, `__DESCRIPTION__`), and Write the result to the target path:

| Source template | Target file |
|---|---|
| `companions/build/templates/entity/manifest.ts` | `companions/__NAME__/manifest.ts` |
| `companions/build/templates/entity/types.ts` | `companions/__NAME__/types.ts` |
| `companions/build/templates/entity/index.ts` | `companions/__NAME__/index.ts` |
| `companions/build/templates/entity/form.tsx` | `companions/__NAME__/form.tsx` |
| `companions/build/templates/entity/pages/List.tsx` | `companions/__NAME__/pages/List.tsx` |
| `companions/build/templates/entity/pages/Detail.tsx` | `companions/__NAME__/pages/Detail.tsx` |
| `companions/build/templates/entity/server/tools.ts` | `companions/__NAME__/server/tools.ts` |

After each Write:

```
mcp__claudepanion__build_append_log({ id: "<entity-id>", message: "wrote <path>" })
```

For the skill file:

1. If `entity.input.example` is set: check for a matching domain playbook at `companions/build/templates/skill-examples/<entity.input.example>.md`. If it exists, use it.
2. Otherwise: use the generic `companions/build/templates/skill.md`.

Substitute the same tokens. Write the result to `skills/__NAME__-companion/SKILL.md`. The directory `skills/__NAME__-companion/` must be created; Claude Code's plugin loader discovers skills at `skills/<name>/SKILL.md` (nested, literal filename).

For `kind: "tool"`, use `companions/build/templates/tool/` — only `manifest.ts`, `index.ts`, `server/tools.ts`, plus the skill file via the same branch logic.

### Step 5 — Register the companion in the host

Two files need editing. Both are load-bearing — miss either and the companion won't work.

#### Step 5a — `companions/index.ts`

Read it first. Current shape:

```ts
import type { RegisteredCompanion } from "../src/server/companion-registry.js";
import { build } from "./build/index.js";
// ...other existing imports, alphabetical by slug

export const companions: RegisteredCompanion[] = [build /*, ...alphabetical */];
```

Add an import for the new companion's binding (remember: `__CAMEL__` is the exported binding in the companion's own `index.ts`):

```ts
import { __CAMEL__ } from "./__NAME__/index.js";
```

Insert it in alphabetical slug order. Add `__CAMEL__` to the `companions` array, preserving alphabetical slug order.

#### Step 5b — `companions/client.ts` (entity kind ONLY)

Skip this sub-step for `kind: "tool"` — tool companions don't register forms/lists/details.

For entity kind, read `companions/client.ts`. Current shape:

```ts
import type { Entity } from "../src/shared/types";
import type { ComponentType } from "react";
import BuildDetail from "./build/pages/Detail";
import BuildListRow from "./build/pages/List";
import BuildForm from "./build/form";
// ...other existing imports

type ArtifactRenderer = ComponentType<{ entity: Entity }>;
type ListRow = ComponentType<{ entity: Entity }>;
type CompanionForm = ComponentType<{ onSubmit: (input: unknown) => void | Promise<void> }>;

const artifactRenderers: Record<string, ArtifactRenderer> = {
  "build": BuildDetail as ArtifactRenderer,
  // ...
};
const listRows: Record<string, ListRow> = {
  "build": BuildListRow as ListRow,
  // ...
};
const forms: Record<string, CompanionForm> = {
  "build": BuildForm as CompanionForm,
  // ...
};

export function getArtifactRenderer(name: string): ArtifactRenderer | undefined { return artifactRenderers[name]; }
export function getListRow(name: string): ListRow | undefined { return listRows[name]; }
export function getForm(name: string): CompanionForm | undefined { return forms[name]; }
```

Add three imports and three registry entries:

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

### Step 6 — Wait for watcher + read reliability snapshot

```
mcp__claudepanion__build_update_status({ id: "<entity-id>", status: "running", statusMessage: "validating" })
```

Wait 2 seconds for the host watcher to debounce + re-mount. Then read the snapshot (GET — read-only — is acceptable):

```bash
curl -s http://localhost:3001/api/reliability/__NAME__
```

Parse `validator.ok` and `smoke.ok` from the response. Log:

```
mcp__claudepanion__build_append_log({ id: "<entity-id>", message: "validator=<bool>, smoke=<bool>" })
```

### Step 7 — Commit

```bash
git add companions/__NAME__ skills/__NAME__-companion companions/index.ts companions/client.ts
git commit -m "companion: scaffold __NAME__"
```

For `kind: "tool"`, omit `companions/client.ts` from `git add`.

### Step 8 — Save artifact + complete

```
mcp__claudepanion__build_save_artifact({
  id: "<entity-id>",
  artifact: {
    filesCreated: [<list of new file paths>],
    filesModified: ["companions/index.ts", "companions/client.ts"],
    summary: "Scaffolded __NAME__ (<kind>).",
    validatorPassed: <bool>,
    smokeTestPassed: <bool>
  }
})

mcp__claudepanion__build_update_status({ id: "<entity-id>", status: "completed" })
```

If the validator reported fatal issues:

```
mcp__claudepanion__build_fail({ id: "<entity-id>", errorMessage: "validator: <joined issues>" })
```

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

Read every file under `companions/<target>/`. Note the manifest version.

### Step 5 — Apply the change

```
mcp__claudepanion__build_update_status({ id: "<entity-id>", status: "running", statusMessage: "applying change" })
```

Judgment step. Read `entity.input.description` and make the requested modifications using Edit. Keep changes focused on what was asked. After each file change:

```
mcp__claudepanion__build_append_log({ id: "<entity-id>", message: "modified <path>" })
```

### Step 6 — Bump version

Update `companions/<target>/manifest.ts` `version` field:

- **Patch** (0.1.0 → 0.1.1) for wording like "fix", "typo", "wording".
- **Major** (0.1.0 → 1.0.0) for explicit "breaking" language.
- **Minor** (0.1.0 → 0.2.0) otherwise.

### Step 7 — Validate via reliability snapshot

Same as new-companion Step 6, but for `<target>`.

### Step 8 — Commit

```bash
git add companions/<target>
git commit -m "companion(<target>): <one-line summary>"
```

### Step 9 — Save artifact + complete

```
mcp__claudepanion__build_save_artifact({
  id: "<entity-id>",
  artifact: {
    filesCreated: [],
    filesModified: [<list of modified paths>],
    summary: "<what changed and why, one or two sentences>",
    validatorPassed: <bool>,
    smokeTestPassed: <bool>
  }
})

mcp__claudepanion__build_update_status({ id: "<entity-id>", status: "completed" })
```

---

## Common mistakes

Every row here caused a real failure in an earlier run. Don't repeat them.

| Mistake | Fix |
|---|---|
| *"Let me curl the MCP endpoint since the tools aren't loaded."* | STOP. Tell the user MCP tools aren't loaded (see the CRITICAL block at the top). Do not fall back to HTTP. |
| *"I'll PATCH /api/entities/<id> to update status."* | The REST API has no PATCH endpoint and shouldn't be used for mutations regardless. Use `mcp__claudepanion__build_update_status`. |
| *"I'll write directly to data/build/<id>.json via a Node script."* | Never. State changes go through MCP tools. Direct file writes bypass logging, watchers, and session context. |
| Skipping `companions/client.ts` registration. | The new companion's form/list/detail registry lives in `client.ts`. Miss it and the UI shows *"No form registered"*. Always edit BOTH `index.ts` and `client.ts` for entity kind. |
| Writing `interface __CAMEL__Input` instead of `interface __PASCAL__Input`. | Type and component names are PascalCase. Variable bindings are camelCase. Verify you computed `__PASCAL__` and substituted it everywhere templates reference types. |
| Using the generic skill stub when a chip example was clicked. | Check `entity.input.example`. If set, use `companions/build/templates/skill-examples/<example>.md` instead of the default. |
| Committing without `git add companions/<name>` and `skills/<name>-companion`. | `git add` must include the new companion directory AND the skill directory AND the registration files. Miss any and next session's diff will be confusing. |
| Writing the skill to `skills/<name>-companion.md` (flat). | Claude Code plugin loader expects nested. Path is `skills/<name>-companion/SKILL.md` with literal filename `SKILL.md`. |

## Red flags — STOP and re-read this skill

- About to write a curl command against `/api/entities`.
- About to invent an MCP tool name not spelled `mcp__claudepanion__build_*` or `mcp__claudepanion__<new-slug>_*`.
- About to edit `data/**/*.json` directly.
- About to skip `companions/client.ts` "because the UI will figure it out."
- About to substitute `__CAMEL__` where a type is declared.
- About to place a skill file as `skills/<name>.md` instead of `skills/<name>/SKILL.md`.

All of these mean: stop, re-read the skill, try again the correct way.
