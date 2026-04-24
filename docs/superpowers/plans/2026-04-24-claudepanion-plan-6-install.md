# Plan 6 — Install Flow (npm-backed, minimal)

**Goal:** A user can install a companion published to npm (prefixed `claudepanion-`) from the running host without restarting. v1 has no marketplace UI — just a single text input ("npm package name") on the `/install` route and a POST endpoint that runs `npm install`, imports the resulting module, and registers it.

**Non-goals (v1):** card browser, star/popularity sort, compatibility badges. Those are v2, tracked in the spec under Deferred.

---

## Task 1 — Sidebar install link

**Files:** `src/client/components/Sidebar.tsx`

Add a sticky "+ Install companion" NavLink at the bottom of the sidebar. It routes to `/install`.

## Task 2 — Install page

**Files:** `src/client/pages/Install.tsx`, router in `App.tsx`

Form with a single text input "Package name" (placeholder `claudepanion-oncall`). Submit button triggers `POST /api/install`. Renders loading state, success (with a link to `/c/<installed-name>`), or error (stderr captured from npm).

## Task 3 — Install endpoint

**Files:** `src/server/api-routes.ts`

`POST /api/install` body `{ packageName }`:
1. Validate `packageName` matches `^claudepanion-[a-z0-9-]+$`.
2. Spawn `npm install <packageName>` in the repo root. Capture stdout + stderr.
3. On non-zero exit, return `{ ok: false, error: stderr }`.
4. Dynamically `import("<packageName>")`. The module should export a `RegisteredCompanion` (named `default` or matching the companion slug).
5. Validate the companion via Plan 2's validator. If fatal issues, return `{ ok: false, error: <issues> }`.
6. Register via `registry.register(companion)`.
7. Return `{ ok: true, companion: manifest }`.

## Task 4 — Registry.register

**Files:** `src/server/companion-registry.ts`

Add `register(companion)` which adds a *new* companion (distinct from `remount` which swaps an existing one). Fires `onChange` so MCP handlers + reliability snapshot pick it up.

## Task 5 — Browser smoke (manual)

Since no real `claudepanion-*` package exists on npm yet, Plan 6's smoke is limited to:
1. Navigate to `/install`.
2. Submit a bogus name (`claudepanion-nonexistent`), confirm graceful error with npm's stderr shown.
3. Submit an invalid name (`not-prefixed`), confirm client-side validation blocks.

Full install + load round-trip is deferred until a real package exists on npm.
