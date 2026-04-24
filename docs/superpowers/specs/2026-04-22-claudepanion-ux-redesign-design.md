# Claudepanion UX Redesign — Design Spec

**Date:** 2026-04-22
**Status:** Draft for implementation
**Companion concept:** see `docs/concept.md`

## Goal

Rebuild claudepanion as a React + Vite host with a filesystem-convention companion architecture and a slash-command handoff UX. Replace HTML template strings with real React components, make Build a bundled companion that scaffolds *and* iterates on other companions, and pin down a narrow typed contract so Claude can generate new companions reliably.

## Non-goals (v1)

- Cross-companion dashboard
- In-app install browser with cards, stars, or popularity sort
- SSE for log streaming (polling is sufficient)
- Server-side heartbeat / auto-fail for stalled entities
- Non-Claude agents
- Hosted claudepanion

---

## Architecture

### Top-level shape

- One host process: Express + MCP server + React SPA served statically, all on a single localhost port.
- Companions live in two places, same contract:
  - **Local:** `companions/<name>/` in the host repo (created by Build or written by hand).
  - **Published:** `node_modules/claudepanion-<name>/` (installed from npm).
- **Build is itself a bundled companion** at `companions/build/`. No privileged core code for scaffolding — Build is the reference implementation of the contract.

### Companion kinds

Every companion declares a `kind` in its manifest:

- **`entity`** — produces discrete work over time. Has a lifecycle (pending → running → completed | error), a form, a list page, a detail page, and an artifact.
- **`tool`** — exposes MCP tools only. No lifecycle, no entities, no pages to write. The host auto-generates an About page from the manifest + tool signatures.

---

## Companion contract

### Required for every companion

- `manifest.ts` — exports:
  ```ts
  export const manifest = {
    name: "expense-tracker",
    kind: "entity",                  // "entity" | "tool"
    displayName: "Expense Tracker",
    icon: "💰",
    description: "OCR receipts, categorize line items, export as CSV.",
    contractVersion: "1",
    version: "0.1.0"                 // bumped on iteration, drives reload
  };
  ```
- `index.ts` — re-exports everything the host imports (`manifest`, `tools`, plus entity-kind exports if applicable).
- `server/tools.ts` — domain-specific MCP tool implementations.

### Additional for `entity` kind

- `types.ts` — `Input` and `Artifact` TypeScript types.
- `form.tsx` — React component for entity creation. Receives `onSubmit(input: Input)`.
- `pages/List.tsx` — React component rendering the companion's entity list. Receives `entities: Entity<Input, Artifact>[]`.
- `pages/Detail.tsx` — React component rendering an entity's artifact body. Receives `entity: Entity<Input, Artifact>`. Only renders the artifact slot; host owns the frame (status, slash command, logs, continuation).

### Optional for `tool` kind

- `about.tsx` — custom About page. If absent, host auto-generates one.

### What the host owns, not the companion

- Entity storage (JSON files on disk).
- Generic MCP tools (auto-registered per companion — see below).
- Detail page frame: breadcrumb, status pill, slash-command block, logs panel, continuation form. Companion provides only the artifact body component.
- List page frame: sidebar, breadcrumb, `+ New` button, status column, empty state. Companion provides row renderer and column definitions.
- About page frame for tool companions: fully auto-generated unless companion provides `about.tsx`.

---

## Entity data model

```ts
interface Entity<Input, Artifact> {
  id: string;                          // "exp-9f2a1b"
  companion: string;                   // "expense-tracker"
  status: "pending" | "running" | "completed" | "error";
  statusMessage: string | null;        // human-readable "current step"
  createdAt: string;                   // ISO
  updatedAt: string;                   // ISO — also serves as liveness heartbeat
  input: Input;                        // companion-typed
  artifact: Artifact | null;           // companion-typed; populated on completion
  errorMessage: string | null;         // set on status === "error"
  errorStack: string | null;           // optional stack trace
  logs: LogEntry[];                    // inline; no separate log stream
}

interface LogEntry {
  timestamp: string;                   // ISO
  level: "info" | "warn" | "error";
  message: string;
}
```

Storage: one file per entity at `data/<companion>/<entity-id>.json`. Atomic writes. No database.

Continuation: "ask Claude to revise" flips an existing entity back to `status: "pending"` while preserving the previous artifact in `input.previousArtifact` (or similar). Companion's skill knows to use it as context.

---

## MCP tools

All tools namespaced per-companion (`<companion>_<verb>`).

### Generic — auto-registered for every entity companion

Host registers these automatically from the companion's manifest + types:

- `<companion>_get(id)` → `Entity<Input, Artifact>`
- `<companion>_list(status?)` → `Entity<Input, Artifact>[]`
- `<companion>_update_status(id, status, statusMessage?)`
- `<companion>_append_log(id, message, level?)`
- `<companion>_save_artifact(id, artifact)`
- `<companion>_fail(id, errorMessage, errorStack?)`

Tool companions get no generic tools (no entities to manage).

### Domain — companion-authored

Whatever the author writes in `server/tools.ts`. The contract validator checks that tool names follow the `<companion>_<verb>` namespacing convention and have typed parameters.

---

## Slash-command handoff

Entity companions ship a skill at `skills/<companion>-companion.md`. The skill is invoked as:

```
/<companion>-companion <entity-id>
```

Standard playbook (scaffolded by Build, customized per companion):

1. `<companion>_get(id)` to load the entity.
2. `<companion>_update_status(id, "running", "starting…")`.
3. Execute domain work, streaming progress via `<companion>_append_log` and `<companion>_update_status`.
4. On success: `<companion>_save_artifact(id, artifact)` then `<companion>_update_status(id, "completed")`.
5. On failure: `<companion>_fail(id, message, stack)`.

For Build specifically, the skill is `/build-companion <entity-id>`. It branches on `input.mode`:

- `"new-companion"` — scaffold `companions/<name>/` from templates, run contract validator, run smoke test.
- `"iterate-companion"` — read existing companion source, apply requested changes, bump `manifest.version`, re-run validator + smoke test.

Either path: Build commits the result to git. Failure at any stage populates `errorMessage` and transitions to `error`.

---

## Reload mechanism

Host watches two things:

- `companions/<name>/manifest.ts` for every local companion — any change (including a `version` bump on iteration) triggers re-mount of that companion.
- Generated `companions/index.ts` — re-exports all companions. New companion added → export list changes → reload; Build also regenerates this file when scaffolding new companions.

On change, host performs a **soft re-mount**:

1. Re-import the changed companion's modules.
2. Re-register its MCP tools (generic + domain).
3. Re-register its API routes.
4. Notify the client via a websocket ping (or polling check) so lazy-loaded React components re-fetch.

No process restart. In-flight requests are not interrupted — a request mid-flight uses the old module; only new requests hit the new version.

---

## UI routes

- `/` — redirects to `/c/<last-visited-companion>`; falls back to `/c/build` on first visit.
- `/c/:companion` — list page (entity kind) or About page (tool kind).
- `/c/:companion/:id` — entity detail page.
- `/install` — install page (v1: "Install from npm…" form; v2: card browser).

---

## App shell

Sidebar sections (dark theme, 220px wide):

```
(logo)
— Core —
  🔨 Build
— Companions —   (entity kind, listed alphabetically)
  💰 Expense Tracker
  📣 Oncall Investigator
  ...
— Tools —        (tool kind, listed alphabetically)
  💡 Homelab
  ...
+ Install companion
```

Default landing: most recently used companion's list page (Build if none visited yet). **No cross-companion dashboard in v1.**

---

## Detail page — four states

Page morphs by `entity.status`; no tabs.

### `pending`

- Status pill top-right.
- Hero: large monospace block with `/<companion>-companion <id>` + one-click Copy button. Gradient background, sky-blue accent.
- Input panel expanded, showing submitted values.
- Empty logs panel with "Waiting for Claude to start…" placeholder.

### `running`

- Status pill top-right with pulsing indicator.
- Amber "Current step" bar showing `statusMessage` (the at-a-glance "what's Claude doing?" signal).
- Slash-command demoted to a one-line strip with Copy + Re-run.
- Input collapsed to a one-liner summary.
- Logs panel gets the most vertical space: dark terminal rendering, color-coded levels, auto-scroll, "polling every 2s" disclosed in header.
- **Stale detection:** if `updatedAt` is more than 10 minutes old while `running`, display "last activity Xm ago" badge + "looks stalled — re-run?" button (flips entity to `pending`).

### `completed`

- Status pill top-right (green).
- Artifact is the hero: companion-rendered body inside a green-bordered frame; companion-declared actions in the frame header (e.g., Copy JSON, Export CSV).
- "Ask Claude to revise" continuation form permanently visible below the artifact. Submitting flips entity to `pending`, preserves artifact as context, generates new slash command.
- Input + logs collapse to one-line peeks (click to expand).

### `error`

- Status pill top-right (red).
- Red-bordered hero: error message as heading, stack trace in a dark code block (never hidden — user will want to share it).
- Retry form with hint field framed as "try again with a hint."
- Logs **expanded by default** (opposite of `completed`).
- Input collapses to a one-liner.

---

## Build — the bundled companion

### Entity shape

```ts
type BuildInput =
  | { mode: "new-companion"; name: string; kind: "entity" | "tool"; description: string }
  | { mode: "iterate-companion"; target: string; description: string };

type BuildArtifact = {
  filesCreated: string[];
  filesModified: string[];
  summary: string;
  validatorPassed: boolean;
  smokeTestPassed: boolean;
};
```

### List-page UI

- Top-right buttons: `+ New companion` (primary) and `⟳ Iterate on existing` (secondary).
- Rows show: Mode pill (purple ✨ new / blue ⟳ iterate), Target (companion name for iterate, `—` for new), Description, Status, Updated.
- Clicking a row → detail page.

### Deep-link from other companions

Every companion's list page header gets a `🔨 Iterate with Build` outlined button next to `+ New <entity>`. Clicking:
1. Opens the iterate form pre-filled with `target: <companion>`.
2. On submit: creates a Build entity, navigates to `/c/build/<build-entity-id>` (pending state, slash command ready).

### Reliability (from concept doc, implemented here)

Three mechanisms, executed by Build's skill before transitioning to `completed`:

1. **Narrow typed contract** — TypeScript interfaces on everything Build writes. Mistakes surface at `tsc` time, not runtime.
2. **Contract validator** — CLI `claudepanion validate <companion-path>` that checks: manifest parses, declared `contractVersion` is supported, exports match the expected shape for the declared `kind`, tool names follow namespacing, `form.tsx`/pages exist for `entity` kind.
3. **Smoke test** — CLI `claudepanion smoke <companion-path>` that imports the companion module and attempts to headlessly render `form.tsx`, `pages/List.tsx`, `pages/Detail.tsx` (entity kind) or `about.tsx` (tool kind). Any crash fails the build loop. Claude retries with the error in context.

---

## Tool-companion About page (auto-generated)

Host renders from manifest + `server/tools.ts`:

- **Header:** icon (from manifest), displayName, package name (`claudepanion-<name>`), version, description, `🔨 Iterate with Build` deep-link.
- **MCP tools list:** each tool's name, typed signature (e.g. `homelab_lights_on(room: string)`), JSDoc comment as description.
- **Try-it panel:** dropdown of tools; on selection, renders input fields inferred from TypeScript parameter types (`string` → text input, `number` → number input, enum → select, `boolean` → checkbox). Invoke button → displays result in a dark JSON block.

Author may override by providing `about.tsx`. If they do, the host passes `{ manifest, tools: ToolMetadata[] }` as props.

---

## Install flow

**v1:** `/install` page has a single action `Install from npm…`. Input field accepts a package name (must start with `claudepanion-`). On submit:

1. Host runs `npm install <pkg>` in its own `package.json`.
2. Regenerates `companions/index.ts` to include the new package.
3. Manifest watcher fires → soft re-mount → new companion appears in sidebar.

**v2 (deferred):** Card browser over `npm search claudepanion-`, sort by popularity, show stars / downloads / author, compatibility badge based on `contractVersion`, in-place upgrade button when `version` is behind.

---

## Contract versioning

Every `manifest.ts` declares `contractVersion: "1"`. Host refuses to load companions declaring an unknown version and surfaces a clear error ("Expense Tracker requires contract v2; host supports v1"). This is cheap forward-compatibility insurance — we don't use it in v1 but it's wired in from day one.

---

## Technology

- **Host:** Node 20 + Express + TypeScript.
- **MCP:** `@modelcontextprotocol/sdk` Streamable HTTP transport, session managed via `Mcp-Session-Id` header.
- **Client:** React 18 + Vite 6 + react-router-dom v6 + react-markdown. Companion pages lazy-imported.
- **Storage:** per-entity JSON files at `data/<companion>/<entity-id>.json`, atomic writes.
- **Skills:** Markdown with YAML frontmatter, installed per-companion under `skills/<companion>-companion.md`. Core host skills (e.g., `/install-companion`) shipped in `skills/core/`.
- **Build distribution:** host itself is a Claude Code plugin (`.claude-plugin/plugin.json`). Published companions are plain npm packages with the `claudepanion-` prefix.

---

## File layout

```
claude-manager/
├─ .claude-plugin/
│  └─ plugin.json
├─ host/
│  ├─ server/
│  │  ├─ index.ts                     # Express bootstrap
│  │  ├─ mcp.ts                       # MCP server mount
│  │  ├─ entity-store.ts              # per-entity JSON I/O
│  │  ├─ companion-registry.ts        # loads companions, soft re-mount
│  │  └─ tools/
│  │     ├─ generic.ts                # auto-registration of <companion>_get etc.
│  │     └─ about-page-renderer.ts    # auto-generates tool-companion About page
│  ├─ client/
│  │  ├─ src/
│  │  │  ├─ App.tsx
│  │  │  ├─ pages/
│  │  │  │  ├─ EntityList.tsx         # frame around companion-provided List
│  │  │  │  ├─ EntityDetail.tsx       # frame around companion-provided Detail
│  │  │  │  ├─ ToolAbout.tsx          # auto-generated About
│  │  │  │  └─ Install.tsx
│  │  │  └─ components/
│  │  └─ vite.config.ts
│  └─ cli/
│     ├─ validate.ts                  # `claudepanion validate`
│     └─ smoke.ts                     # `claudepanion smoke`
├─ companions/
│  ├─ index.ts                        # generated; re-exports all companions
│  └─ build/                          # bundled companion
│     ├─ manifest.ts
│     ├─ index.ts
│     ├─ types.ts
│     ├─ form.tsx
│     ├─ pages/
│     │  ├─ List.tsx
│     │  └─ Detail.tsx
│     ├─ server/
│     │  └─ tools.ts
│     └─ templates/                   # scaffold templates for new companions
├─ skills/
│  ├─ core/
│  │  └─ install-companion.md
│  └─ build-companion.md              # bundled by Build companion
├─ data/                              # runtime entities (gitignored)
│  └─ build/
├─ docs/
└─ package.json
```

---

## What stays from the current claudepanion

Very little. This is a clean rewrite. Nothing in the current `template-strings` UI survives; the MCP server is rewritten against the new entity model; skills are regenerated per companion. The concept doc (`docs/concept.md`) stays — it's the north star.

## What's cribbed from oncall-investigator

The following patterns are proven there and we take them whole:

- Per-entity JSON storage with atomic writes.
- Status lifecycle + `statusMessage` + inline logs + polling-based client.
- MCP Streamable HTTP transport with session header.
- Continuation-as-flip-to-pending pattern.
- Terminal-style log rendering in the detail page.

---

## Open questions (deferred to the implementation plan)

- Exact Vite config for lazy-importing companions (split bundles vs single bundle with dynamic imports).
- Manifest watcher debouncing window (100ms? 500ms?).
- How React hot-reload plays with soft re-mount during development (likely: dev uses Vite HMR, prod uses manifest watcher).
- Iteration artifact format — store diff text, list of files, or a commit SHA?
- Whether the core `/install-companion` skill ships in v1 or defers to the `/install` UI page.

These don't block the spec; the implementation plan will resolve them.

---

## Success criteria

v1 ships when:

1. Host runs on localhost with `npm start`, serves the React SPA, and mounts the MCP server.
2. Build companion can scaffold a new entity companion via slash command and have it appear in the sidebar without a host restart.
3. Build companion can iterate on an existing companion (modify source, bump version, re-mount) without a host restart.
4. An entity companion (expense-tracker as the reference example) goes through all four states correctly, with polling-driven log updates in the UI.
5. A tool companion (homelab as the reference example) renders a working auto-generated About page with an invocable Try-it panel.
6. Contract validator and smoke test CLIs are wired into Build's skill.
7. `/install` page can install a `claudepanion-<name>` package from npm and the new companion appears without restart.
