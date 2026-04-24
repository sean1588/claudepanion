# Claudepanion UX Redesign — Plan Roadmap

Spec: [`../specs/2026-04-22-claudepanion-ux-redesign-design.md`](../specs/2026-04-22-claudepanion-ux-redesign-design.md)

The redesign is broken into six sub-plans. Each produces working, testable software on its own. Write and implement them in order — later plans depend on types, file layouts, and contracts established earlier.

## Cadence

Implement each plan fully (including its review gate) before drafting the next. Earlier implementation work often reveals type or contract adjustments that would force a rewrite of later plans drafted prematurely.

## The Plans

### Plan 1 — Host MVP + reference companion
File: [`2026-04-22-claudepanion-plan-1-host-mvp.md`](./2026-04-22-claudepanion-plan-1-host-mvp.md)

Vite + React app shell with sidebar of companions, Express host with REST + MCP Streamable HTTP, per-entity atomic JSON storage, generic MCP plumbing (`_get`/`_list`/`_update_status`/`_append_log`/`_save_artifact`/`_fail`) auto-registered per entity companion, polling detail page (pending/running/completed/error states), continuation flow, and one hand-written reference companion (`expense-tracker`) to exercise the contracts end-to-end.

### Plan 2 — Watcher, validator, smoke test
Scope: File watcher on `companions/*/manifest.ts` and generated `companions/index.ts` triggering soft re-mount (no process restart). Contract validator that checks manifest shape, `contractVersion`, required exports, and required MCP tool set per kind. Smoke test runner that invokes each domain tool with synthetic input and asserts no throw. Surfaces validation + smoke results in the UI so Build can see them after generating a companion.

### Plan 3 — Build companion, new-companion mode
Scope: Bundle Build as a companion at `companions/build/` (entity kind). `input.mode = "new-companion"` path: slash-command handoff spec, scaffolding into `companions/<name>/` using templates, writing manifest/form/pages/artifact/server, invoking validator + smoke from Plan 2, persisting artifact that includes generated file paths and validation results. Build's own list page shows past generations with status.

### Plan 4 — Tool-kind companions + auto About page
Scope: Second companion kind (`kind: "tool"`) — MCP tools only, no entity lifecycle. Host auto-generates the About page from `manifest.ts` + TypeScript signatures in `server/tools.ts` (JSDoc as description, parameter types → Try-it panel inputs). Generic entity tools are NOT registered for tool-kind companions. Optional `about.tsx` override.

### Plan 5 — Build iterate-companion mode
Scope: `input.mode = "iterate-companion"` path on Build. Reads target companion's current source, applies user's requested change, bumps `manifest.version`, re-runs validator + smoke. Deep-link button ("Iterate with Build") on every companion's list page + About page pre-fills target. Works uniformly for entity and tool kinds.

### Plan 6 — Install flow (npm-backed, minimal)
Scope: "+ Install companion" entry from sidebar. v1 accepts an npm package name (`claudepanion-<name>` prefix enforced), installs via npm into the app's companions workspace, validates the installed package against the contract, and triggers the soft re-mount from Plan 2. No in-app registry browser (deferred to v2).

## After Plan 6

Redesign is feature-complete against the spec. Any work beyond this point should go through a fresh brainstorm — v2 items like the in-app install browser, SSE, and server-side stall heartbeat live in the spec's "Deferred" section.
