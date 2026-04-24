---
name: build-companion
description: Invoked with `/build-companion <entity-id>`. Scaffolds a new companion from templates, or iterates on an existing one (plan 5). Runs validator + smoke and persists the result as the Build entity's artifact.
---

# /build-companion <entity-id>

## Step 1 — Load

Call `build_get(id)`. Branch on `entity.input.mode`.

---

## Mode: new-companion

### Step 2 — Validate input

`entity.input` has `name`, `kind`, `description`. Reject if `name` doesn't match `^[a-z][a-z0-9-]*$`,
if `kind` isn't `"entity"` or `"tool"`, or if a directory already exists at `companions/<name>/`.
On any rejection: `build_fail(id, "<message>")` and stop.

Set up substitutions:
- `__NAME__` = the slug (e.g., `oncall-investigator`)
- `__CAMEL__` = camelCase name (e.g., `oncallInvestigator`) — strip hyphens and uppercase the next char
- `__DISPLAY__` = a reasonable titleized name ("Oncall Investigator")
- `__ICON__` = choose a single emoji that fits the description (e.g., 📣)
- `__DESCRIPTION__` = the user's description, one line, no newlines

### Step 3 — Mark running

`build_update_status(id, "running", "scaffolding files")`

### Step 4 — Scaffold files

For `kind: "entity"`, read each file under `companions/build/templates/entity/` and write it to
`companions/<name>/` with tokens substituted. Files to create (for entity kind):

- `companions/<name>/manifest.ts`
- `companions/<name>/types.ts`
- `companions/<name>/index.ts`
- `companions/<name>/form.tsx`
- `companions/<name>/pages/List.tsx`
- `companions/<name>/pages/Detail.tsx`
- `companions/<name>/server/tools.ts`
- `skills/<name>-companion.md` (from `companions/build/templates/skill.md`)

After each file write, call `build_append_log(id, "wrote <path>")`.

For `kind: "tool"`, read from `companions/build/templates/tool/` instead and write:

- `companions/<name>/manifest.ts`
- `companions/<name>/index.ts`
- `companions/<name>/server/tools.ts`

No form, pages, or types files — the About page is auto-generated from the manifest and the `defineTool` metadata attached to each handler.

### Step 5 — Regenerate companions/index.ts

Rewrite `companions/index.ts` so it imports and re-exports the new companion alongside existing ones.
Preserve alphabetical order by slug. Example:

```ts
import type { RegisteredCompanion } from "../src/server/companion-registry.js";
import { build } from "./build/index.js";
import { newName } from "./<new-name>/index.js";
// ...other existing imports, alphabetical by slug

export const companions: RegisteredCompanion[] = [build, /* rest alphabetical */];
```

Also update `companions/client.ts` so the new companion's form/list/detail are registered.

### Step 6 — Wait for watcher + reliability

After writing `companions/index.ts`, the host watcher fires and re-mounts. Wait briefly (poll
the reliability endpoint if you have http access; otherwise 1–2 seconds is enough in dev).

### Step 7 — Read reliability snapshot

Fetch `/api/reliability/<name>` (via your HTTP tool of choice, or have the user check it).
Extract `validator.ok` and `smoke.ok`.

`build_append_log(id, "validator: <ok?>, smoke: <ok?>")`

### Step 8 — Commit

```bash
git add companions/<name> skills/<name>-companion.md companions/index.ts companions/client.ts
git commit -m "companion: scaffold <name>"
```

### Step 9 — Save artifact + complete

```js
build_save_artifact(id, {
  filesCreated: [...list of paths written],
  filesModified: ["companions/index.ts", "companions/client.ts"],
  summary: `Scaffolded ${name} (${kind}).`,
  validatorPassed: true/false,
  smokeTestPassed: true/false
})

build_update_status(id, "completed")
```

If validator failed fatally: `build_fail(id, "validator: <issues>")`.

---

## Mode: iterate-companion

### Step 2 — Load target

`entity.input` has `target` (slug) and `description` (what to change). Verify:
- `companions/<target>/` exists.
- `<target>` is not `build` (self-iteration is disallowed — `build_fail(id, "cannot iterate on Build itself")` and stop).

### Step 3 — Mark running

`build_update_status(id, "running", "reading current source")`

### Step 4 — Read current source

Read all relevant files:
- Always: `companions/<target>/manifest.ts`, `companions/<target>/server/tools.ts`.
- For entity kind (check `manifest.kind`): also `types.ts`, `form.tsx`, `pages/List.tsx`, `pages/Detail.tsx`.

### Step 5 — Apply the change

`build_update_status(id, "running", "applying change")`

This is the judgment step. Read the user's description in `entity.input.description` and make the requested modifications using the Edit tool. Keep changes focused on what was asked. If the description is ambiguous, make the smallest reasonable change and note what you did in the artifact summary.

After each file change: `build_append_log(id, "modified <path>")`.

### Step 6 — Bump version

Read `companions/<target>/manifest.ts` current `version`. Bump it:
- Patch (0.1.0 → 0.1.1) for wording/description like "fix", "typo", "wording".
- Major (0.1.0 → 1.0.0) for explicit "breaking" language.
- Minor (0.1.0 → 0.2.0) otherwise.

Write the new version back to `manifest.ts`.

### Step 7 — Wait for reliability

The manifest change triggers the watcher → re-mount → fresh reliability snapshot. Fetch `/api/reliability/<target>` and extract `validator.ok` + `smoke.ok`.

### Step 8 — Commit

```bash
git add companions/<target>
git commit -m "companion(<target>): <one-line summary>"
```

### Step 9 — Save artifact + complete

```js
build_save_artifact(id, {
  filesCreated: [],
  filesModified: ["companions/<target>/<each modified>", "companions/<target>/manifest.ts"],
  summary: "<one or two sentences of what changed and why>",
  validatorPassed: true/false,
  smokeTestPassed: true/false
})
build_update_status(id, "completed")
```

On any error: `build_fail(id, errorMessage, errorStack?)`.
