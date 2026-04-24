# Plan 3 — Build Companion (new-companion mode)

**Goal:** Bundle Build as the first shipped entity companion. Build entities represent either a "new companion" scaffolding run or (Plan 5) a "iterate on existing" run. For Plan 3 only the `new-companion` mode is wired end-to-end. Build's skill playbook reads templates from `companions/build/templates/` and writes a new companion directory, then invokes Plan 2's validator + smoke to confirm the scaffolded output parses and imports.

**Architecture:** Build has no domain MCP tools — scaffolding is done by Claude using its native Write tool, guided by the skill. The only inputs Claude needs are the templates and the name/kind/description from `input`. The artifact records filesCreated + validatorPassed + smokeTestPassed.

---

## Task 1 — Build companion scaffolding

**Files:** `companions/build/{manifest.ts,types.ts,index.ts,form.tsx,server/tools.ts,pages/List.tsx,pages/Detail.tsx}`

- `types.ts` — BuildInput is a discriminated union `{ mode: "new-companion" | "iterate-companion", … }`. BuildArtifact has `filesCreated`, `filesModified`, `summary`, `validatorPassed`, `smokeTestPassed`.
- `manifest.ts` — `name: "build"`, `kind: "entity"`, icon 🔨, contractVersion "1", version "0.1.0".
- `form.tsx` — For Plan 3, render only the new-companion fields (name, kind dropdown, description). Iterate mode will be added in Plan 5.
- `pages/List.tsx` — row shows mode pill (purple ✨ new), name/target, description, created-at.
- `pages/Detail.tsx` — artifact body: files-created list, validator pass/fail, smoke pass/fail, plain text summary.
- `server/tools.ts` — empty `tools = {}`.

## Task 2 — Templates

**Files:** `companions/build/templates/<kind>/...` for `entity` kind only in Plan 3.

Literal files, not placeholders — they use obvious tokens like `__NAME__`, `__DISPLAY__`, `__ICON__`, `__DESCRIPTION__` that the skill's scaffolding step substitutes before writing.

Files (entity kind):
- `templates/entity/manifest.ts`
- `templates/entity/index.ts`
- `templates/entity/types.ts`
- `templates/entity/form.tsx`
- `templates/entity/pages/List.tsx`
- `templates/entity/pages/Detail.tsx`
- `templates/entity/server/tools.ts`

Also: `templates/skill.md` that fills in the skill playbook for the new companion.

## Task 3 — Build skill

**Files:** `skills/build-companion.md`

Playbook branches on `input.mode`. For `"new-companion"`:
1. `build_get(id)` — fetch entity.
2. `build_update_status(id, "running", "scaffolding files")`.
3. Read templates from `companions/build/templates/<kind>/`.
4. For each template, substitute tokens and write to `companions/<new-name>/<path>`.
5. Append generated companion to `companions/index.ts` export list (or regenerate it).
6. `build_update_status(id, "running", "validating")` and fetch `/api/reliability/<new-name>` after the watcher fires.
7. Persist artifact via `build_save_artifact(id, {filesCreated, validatorPassed, smokeTestPassed, summary})`.
8. `build_update_status(id, "completed")` or `build_fail(id, …)` on any error.

Iterate mode: documented as "Plan 5 — stay tuned".

## Task 4 — Sidebar + registration

**Files:** `companions/index.ts`, `src/client/components/Sidebar.tsx` (verify render)

- Register Build in `companions/index.ts` before expense-tracker (core section).
- Remove the "soon" label on the Build sidebar entry; make it a real link to `/c/build`.

## Task 5 — companions/index regenerator

**Files:** `src/server/reliability/regenerate-index.ts`

Exposes `regenerateCompanionsIndex(repoRoot)` that scans `companions/*/index.ts` and rewrites `companions/index.ts` to re-export them. Plan 3 uses it as a utility; skill calls it after writing new companion files. Smoke test with a small fixture companion dir.

## Task 6 — Browser smoke

Navigate to `/c/build`. Verify:
- List page empty state.
- `+ New` opens form with name / kind / description fields.
- Submit → pending detail page with `/build-companion <id>` slash command.

Done when a Build entity can be created and the skill playbook renders correctly in the detail page's slash command block.
