# Plan 7 — Close the spec gaps

**Goal:** Land the three shipping-blockers from the spec-comparison audit plus three high-value quick wins. After this plan, every item in the spec's success criteria that doesn't require a real npm package or scaffolding run to validate should be working.

**Out of scope:** Validator/smoke CLIs, `about.tsx` override, pulsing status pill, artifact header actions, logs collapse on completed state, react-markdown, last-visited companion persistence. These are follow-ups, not shipping-blockers.

---

## Task 1 — Install persists companions/index.ts

**Files:** `src/server/api-routes.ts`, `src/server/companions-index.ts` (new)

`registerCompanion()` currently only updates in-memory registry. Install goes away on restart. Fix:

- New utility `rewriteCompanionsIndex(repoRoot, registry)` that scans the current registry and regenerates `companions/index.ts` with proper imports + alphabetical sort.
- Install endpoint calls it after `registry.register()` succeeds.
- Install endpoint also handles the case where the package is local vs. from node_modules: for npm-installed companions, the import path is the package name (not `./<slug>/index.js`).

Complication: currently `companions/index.ts` imports via relative paths (`./build/index.js`). Installed npm packages need bare imports. So the generated file must mix both. Track in-memory which companions are "local" vs "installed" — the simplest signal is: if a companion's module came from `/node_modules/`, it's installed; otherwise local.

Add a `source: "local" | "installed"` tag when registering. The generator picks the right import form per source.

## Task 2 — Sidebar auto-refreshes on registry changes

**Files:** `src/client/hooks/useCompanions.ts`, `src/client/pages/Install.tsx` (consumer)

Polling is the right tool here — the existing pattern for entities uses 2s polls. Companions change infrequently, so 5s is plenty. `useCompanions` gets a `setInterval` refetch, plus an optional `refetch()` returned so Install can trigger immediate refresh after success.

## Task 3 — Plugin manifest

**Files:** `.claude-plugin/plugin.json` (new)

Minimal shape matching Claude Code plugin spec:
- `name: "claudepanion"`
- `version` matching package.json
- `mcpServers` referencing the existing `.mcp.json`
- `skills` glob pattern for `skills/*.md`

Also: README section on "installing as a plugin" currently says `claudepanion plugin install` — this references a CLI that doesn't exist. Either build the CLI (large scope) or update README to explain manual install. Pick the latter.

## Task 4 — Build list two-button header

**Files:** `src/client/pages/EntityList.tsx`, `companions/build/form.tsx`

Spec wants two CTAs on the Build list page:
- `+ New companion` (primary) → `/c/build/new` with mode=new preset
- `⟳ Iterate on existing` (secondary) → `/c/build/new?mode=iterate`

Easy: add a `companion === "build"` branch in EntityList header that renders two buttons instead of one. The form already handles both modes via the query param, so this is pure wiring.

## Task 5 — Skill commits scaffolded work

**Files:** `skills/build-companion.md`

Append a Step 9 ("Commit to git") to both mode branches: `git add companions/<name> skills/<name>-companion.md companions/index.ts companions/client.ts && git commit -m "companion: scaffold <name>"` (or iterate equivalent).

## Task 6 — Browser + fs smoke

- Install page success path: stub the fs side (inject a fake companion directly into the registry, then call `rewriteCompanionsIndex`) and verify `companions/index.ts` got the new entry.
- Open browser, wait 6s, confirm sidebar gained the new link without reload.
- Verify `/c/build` now shows both CTA buttons.
