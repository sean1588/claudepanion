# Plan 5 — Build iterate-companion mode

**Goal:** Make Build work on existing companions. A Build entity with `input.mode === "iterate-companion"` represents "read this companion's source, apply my requested change, bump version, re-validate." No new server surface — validator/smoke/watcher already work kind-agnostically. This plan is mostly a skill playbook + UX wiring.

---

## Task 1 — Build form: mode selector + iterate fields

**Files:** `companions/build/form.tsx`

Add a segmented control at the top: "✨ New" vs "⟳ Iterate". When "Iterate" is selected, show a target companion dropdown (populated from `/api/companions` minus Build itself) and a description textarea.

Also: on mount, read `?mode=iterate&target=<name>` query params and pre-select the iterate tab with the target filled in. Description starts empty.

## Task 2 — Deep-link button everywhere

**Files:**
- `src/client/pages/EntityList.tsx` — add "🔨 Iterate with Build" outlined button next to "+ New".
- `src/client/pages/ToolAbout.tsx` — add the same button in the header area.

Both link to `/c/build/new?mode=iterate&target=<current-companion>`.

Build itself should not show the Iterate button (self-reference is awkward); skip it when `companion === "build"`.

## Task 3 — Build skill playbook: iterate branch

**Files:** `skills/build-companion.md`

Replace the "Plan 5 — stay tuned" stub with the full iterate playbook:
1. `build_get(id)` and verify `input.mode === "iterate-companion"`.
2. Read `companions/<target>/` — manifest, types, form, pages, server/tools. For tool kind, only manifest + server/tools.
3. `build_update_status(id, "running", "applying changes")`.
4. Apply the change described in `input.description`. (Claude uses native Edit tool; this is the judgment step.)
5. Bump `companions/<target>/manifest.ts` version — minor bump (0.1.0 → 0.2.0) by default unless the change description clearly indicates a patch (wording like "fix", "typo") or major (explicit breaking change).
6. Watcher fires → reliability snapshot refreshed.
7. `build_save_artifact(id, { filesCreated: [], filesModified: [...], summary, validatorPassed, smokeTestPassed })`.
8. `build_update_status(id, "completed")` or fail on any error.

## Task 4 — Browser smoke

- From the expense-tracker list page, click "🔨 Iterate with Build".
- Confirm the form opens in iterate mode with target pre-filled.
- Submit a change, confirm pending detail renders correctly.
- From the homelab About page, click "🔨 Iterate with Build". Confirm same flow.
