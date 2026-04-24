# Plan 2 — Watcher, Validator, Smoke Test

**Goal:** Wire the reliability mechanisms the spec calls out: a contract validator that fails fast on malformed companions, a smoke test that exercises their tools, and a file watcher that soft-remounts on change. Surface results in the UI so Build (Plan 3) can read them programmatically.

**Architecture:** All three live in `src/server/reliability/`. Validator is pure — takes a companion module + manifest, returns a typed report. Smoke runner is async — calls each domain tool with synthetic input drawn from a simple heuristic, records throw / pass per tool. Watcher uses `chokidar` on `companions/**/manifest.ts` and `companions/index.ts`, debounced 200ms, triggers re-register through the existing registry. No process restart; in-flight requests use the old module until they complete.

**Scope limits:** React component rendering smoke is out of scope for Plan 2 (comes free with `tsc` + tests). Plan 2 smoke only exercises MCP tool callability.

---

## Task 1 — Contract validator

**Files:**
- Create: `src/server/reliability/validator.ts`
- Create: `tests/server/reliability/validator.test.ts`

Validator takes `{ manifest, module, companionDir }` and returns:

```ts
type ValidationIssue = { code: string; message: string; fatal: boolean };
type ValidationReport = { ok: boolean; issues: ValidationIssue[] };
```

Checks:
- `manifest.name` matches `^[a-z][a-z0-9-]*$` — fatal
- `manifest.kind` is `"entity"` or `"tool"` — fatal
- `manifest.contractVersion === "1"` — fatal (unknown → message names the supported version)
- `manifest.version` parses as semver-like `x.y.z` — non-fatal
- `manifest.displayName`, `icon`, `description` non-empty strings — non-fatal
- For `kind === "entity"`: `module.tools` is a record, and every tool key is prefixed with `<name>_` — non-fatal
- For `kind === "entity"`: companion dir has `form.tsx`, `pages/List.tsx`, `pages/Detail.tsx`, `types.ts` — non-fatal
- For `kind === "tool"`: companion dir has `server/tools.ts` — non-fatal (covered by `index.ts` import but still verified)

TDD: one test per rule, passing + failing case.

**Commit:** `plan-2: contract validator`

---

## Task 2 — Smoke test runner

**Files:**
- Create: `src/server/reliability/smoke.ts`
- Create: `tests/server/reliability/smoke.test.ts`

Smoke imports the module (caller passes in the loaded module) and runs its domain tools with synthetic inputs. Report shape:

```ts
type SmokeResult = { tool: string; ok: boolean; error?: string };
type SmokeReport = { ok: boolean; results: SmokeResult[] };
```

Synthesis heuristic (v1 is intentionally dumb):
- If tool's Zod schema is detectable (future) use it. For v1, just pass `{}` and record the outcome.
- A tool that throws on empty input is acceptable — we only fail smoke if the error is a TypeError or ReferenceError (indicates code-level bug, not validation).

Entity companions with zero domain tools produce an empty, passing report.

**Commit:** `plan-2: smoke test runner`

---

## Task 3 — Re-mountable registry + watcher

**Files:**
- Modify: `src/server/companion-registry.ts` — add `remount(companion)` that replaces an existing entry in-place (same object ref, mutate fields).
- Create: `src/server/reliability/watcher.ts` — chokidar watcher, debounced, calls `remount`.
- Modify: `src/server/index.ts` — wire watcher on boot, off in test env.
- Create: `tests/server/reliability/watcher.test.ts` — fake-timer debounce test + remount assertion.

Watch globs: `companions/*/manifest.ts`, `companions/*/manifest.js` (prod builds), `companions/index.ts`. Debounce 200ms. On fire:
1. Dynamically import the changed companion with cache-busting query (`?t=<Date.now()>`).
2. Re-run validator against the new module.
3. If validator fatal → log error + keep old module mounted.
4. If validator ok → call `registry.remount(newCompanion)` which swaps tools + manifest + artifact renderer lookup.
5. Emit `registry-changed` event the MCP server listens to and re-registers tools.

**Commit:** `plan-2: watcher + soft re-mount`

---

## Task 4 — Reliability REST surface

**Files:**
- Modify: `src/server/api-routes.ts` — add `GET /api/reliability/:companion` returning `{ validator: ValidationReport, smoke: SmokeReport, ranAt: string }`.
- Modify: `src/server/companion-registry.ts` — cache last report per companion, update on remount.
- Create: `tests/server/reliability/api.test.ts`.

No UI yet — Build (Plan 3) will consume this. For eyeballing during dev, the JSON is enough.

**Commit:** `plan-2: reliability REST endpoint`

---

## Task 5 — Smoke verification in browser

Run full build, start server, navigate to `/api/reliability/expense-tracker`, confirm it returns `{ validator: { ok: true, issues: [] }, smoke: { ok: true, results: [] }, ranAt: ... }`. Touch `companions/expense-tracker/manifest.ts` (bump version), confirm watcher fires (server logs the remount), re-fetch endpoint and confirm `ranAt` changed.

**Commit:** `plan-2: end-to-end remount verified`
