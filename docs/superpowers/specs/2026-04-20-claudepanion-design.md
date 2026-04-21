# claudepanion — Design Spec

**Date:** 2026-04-20
**Status:** Approved for implementation planning
**Predecessor:** claude-manager (this repo, pre-pivot)

---

## 1. Positioning & scope

### What claudepanion is

A localhost companion host that lets developers build small single-user web apps — "companions" — whose backend work is performed by Claude Code over MCP. The browser UI is a launcher and per-companion interface; Claude Code, running in the claudepanion repo, is the agent that picks up pending work and streams progress back.

### Primary value proposition

A reference architecture for *codebases designed to be extended through Claude via MCP*. Users learn the pattern by reading claudepanion's own source, then extend the scaffold by using the bundled **Build** companion — which demonstrates the same pattern it scaffolds. The reference implementation and the scaffolding tool are the same artifact.

### User personas

- A developer who wants a browser-based interface for a recurring Claude-mediated workflow (oncall investigation, research briefs, repetitive code reviews).
- A developer who wants a reference architecture for building MCP-mediated UIs and will fork or copy the pattern.

### Non-goals

- **Not multi-tenant.** One user, one machine, localhost only.
- **Not a plugin marketplace.** Companions live inside the user's claudepanion clone.
- **Not a hot-reload framework.** Adding companions requires a server restart. Dev mode makes this automatic.
- **Not a server-side LLM platform.** claudepanion never calls the Anthropic API. All "intelligence" is Claude Code, accessed via MCP.
- **Not polished product.** It is developer tooling — opinionated, sharp edges intentional.

### Rename

Complete rename `claude-manager` → `claudepanion`, in one atomic commit after the pivot work is staged. In scope: repo directory, `package.json` `name`, CLI binary (`bin/claudepanion`), plugin identifiers (`plugin.json`, `marketplace.json`, `McpServer({ name })`, `.mcp.json` server key), skill directory (`skills/use-claudepanion/`), all README/doc prose, nav logo text.

---

## 2. Architecture & file layout

### Repo layout (post-pivot)

```
claudepanion/
├── .mcp.json                            plugin → localhost:3000/mcp
├── .claude-plugin/
│   ├── plugin.json                      plugin metadata
│   └── marketplace.json                 local marketplace manifest
├── bin/claudepanion                     CLI: serve, dev, plugin install/uninstall
├── skills/
│   ├── use-claudepanion/SKILL.md        platform meta-skill (loads at session start)
│   └── build/SKILL.md                   Build companion's skill
├── companions/
│   └── build/                           the only companion that ships
│       ├── manifest.json                { slug, name, description, icon? }
│       ├── tools/
│       │   ├── list.ts                  → registers as `build_list`
│       │   ├── claim.ts                 → `build_claim`
│       │   ├── log.ts                   → `build_log`
│       │   └── complete.ts              → `build_complete`
│       ├── ui.ts                        renderPage(ctx): string | Promise<string>
│       ├── store.ts                     build-specific data helpers
│       └── routes.ts                    (optional) Express router for browser mutations
├── data/                                runtime JSON (gitignored contents)
│   ├── .gitkeep
│   └── build.json
├── src/
│   ├── server.ts                        Express app, SSE, routing
│   ├── companions.ts                    scans companions/*/, loads them
│   ├── mcp.ts                           mountMcp, registers all companion tools
│   ├── storage.ts                       generic JSON store helpers
│   ├── helpers/
│   │   └── requestStore.ts              reusable pending/running/done pattern
│   ├── types.ts                         Companion, McpToolDefinition, CompanionContext
│   └── ui/
│       └── layout.ts                    platform shell (nav, SSE wiring)
├── tests/
│   ├── unit/
│   └── integration/
├── docs/
│   ├── architecture.md                  MCP lifecycle, transport internals
│   ├── companion-contract.md            authoritative companion spec (Build reads this)
│   └── troubleshooting.md
├── package.json
├── tsconfig.json
└── README.md
```

### Companion contract

A companion is a directory under `companions/` with:

| File | Required | Purpose |
|------|----------|---------|
| `manifest.json` | yes | `{ slug, name, description, icon?: string }` |
| `tools/*.ts` | yes | One file per MCP tool; each default-exports an `McpToolDefinition`. Platform prefixes names with `<slug>_` at registration. |
| `ui.ts` | yes | Exports `renderPage(ctx: CompanionContext): string \| Promise<string>` returning the body HTML for `/c/<slug>`. |
| `store.ts` | no (usable via helper) | Companion-owned data shape + read/write helpers. Built on `storage.ts` or `helpers/requestStore.ts`. |
| `routes.ts` | no | Express `Router` default-exported; platform mounts at `/api/c/<slug>/*`. |

The companion's **skill** lives at `skills/<slug>/SKILL.md` at the plugin root — *not* inside the companion directory. Claude Code's plugin-skill discovery only scans `skills/<name>/SKILL.md` at the plugin root.

### Platform boundary — `CompanionContext`

The host exposes a minimal interface to each companion:

```ts
interface CompanionContext {
  slug: string;
  broadcast(event: string, data: unknown): void;   // push SSE to UI
  store: {
    read<T>(): Promise<T>;
    write<T>(data: T): Promise<void>;               // atomic tmp+rename
  };
  log(...args: unknown[]): void;                    // structured stderr
}
```

No lifecycle hooks, no startup/shutdown callbacks, no inter-companion communication, no shared state. Explicit by design.

### Discovery

On server start, `src/companions.ts`:

1. Reads `companions/*/manifest.json` sorted by slug.
2. Validates each slug against `^[a-z][a-z0-9-]*$` and uniqueness.
3. Dynamically imports each companion's `tools/*.ts`, `ui.ts`, and (if present) `routes.ts`.
4. Registers tools on the `McpServer` factory (slug-prefixed), mounts UI at `GET /c/<slug>`, mounts routes at `/api/c/<slug>/*`.
5. Passes the companion list to the layout so the left-nav renders with one entry per companion.

A new companion is picked up on next server restart. No hot-reload. See Section 5 for dev-mode mechanics.

### Stack

- Express + server-rendered HTML + SSE (existing).
- No React, Vite, or client-side framework.
- Vanilla `<script>` for per-page client behavior, using platform-provided globals (`api()`, `EventSource`, `showToast()`).
- Rationale: UI is simple (list + detail + form), SRH is Claude-readable (`/build` can generate pages without framework knowledge), minimum dependencies keep the reference pedagogically clean.

---

## 3. Claude-facing surface — MCP + Build + skills

### MCP surface

- One `McpServer` instance per session (stateful Streamable HTTP, existing pattern).
- At startup, platform collects every companion's `tools/*.ts`, prefixes each tool name with `<slug>_`, registers them on a server-factory function. Each new session creates a fresh `McpServer` wired with the full tool set.
- Tool descriptions lead with the companion name in brackets, for disambiguation in a crowded tool list:

| Tool | Description |
|------|-------------|
| `build_list` | *"[build] List pending / running / completed build requests."* |
| `build_claim` | *"[build] Claim a pending build request. Moves status → running."* |
| `build_log` | *"[build] Append a progress line to a running build. Streams live to UI."* |
| `build_complete` | *"[build] Finish a running build. Writes scaffolded files to disk, renders markdown summary."* |

- Slug validation `^[a-z][a-z0-9-]*$` and uniqueness enforced at startup. Duplicates fail loudly.

### Build companion — end-to-end flow

**UI side:**

1. User opens Claudepanion, lands on `/c/build` (first companion in alphabetical nav).
2. Textbox with placeholder *"A companion that reads a URL and produces a markdown summary."*, plus a list of past requests.
3. Submit → `POST /api/c/build/requests` → platform writes `{ id, status: 'pending', description, createdAt }` to `data/build.json`, broadcasts `build.request_created`.
4. User watches the card transition `pending → running` on claim, log lines appearing live on each `build_log`, then `done` with a rendered markdown summary and collapsible list of written files.

**Claude side (Claude Code in the claudepanion repo):**

1. Session starts. Platform meta-skill `use-claudepanion` loads, describing MCP surface and the polling pattern.
2. User nudges Claude, or the meta-skill prompts Claude to call `build_list` at session start.
3. Claude sees pending request, calls `build_claim({ id })` — status → `running`, broadcast fires.
4. Claude follows `skills/build/SKILL.md`:
   - Choose a slug. Validate uniqueness against `companions/*/manifest.json`.
   - Design the companion — manifest fields, tool set, UI shape, data schema.
   - Generate each file as a `{ path, content }` pair.
   - Call `build_log({ id, message })` between major steps.
5. Calls `build_complete({ id, files: [...], summary: '...markdown...' })`.
6. Platform's `build_complete` handler:
   - Stages files in `.claudepanion-stage-<uuid>/` and fsyncs.
   - Validates paths stay within `companions/<slug>/` and `skills/<slug>/` (reject path traversal).
   - `mv` staging into place, all-or-nothing.
   - Updates `data/build.json` with result; broadcasts final `build.request_updated`.
7. UI renders markdown summary. If not in dev mode, completion summary includes "Restart the server to activate this companion."

### Skills layout

```
skills/
├── use-claudepanion/SKILL.md        platform meta-skill, always loads
├── build/SKILL.md                    Build companion's skill
└── <slug>/SKILL.md                   (future, scaffolded by Build)
```

**`skills/use-claudepanion/SKILL.md`** — always-on meta-skill. Describes:
- The MCP surface pattern (namespaced tools, SSE broadcast, polling).
- The companion pattern (pending → claim → log → complete).
- Instruction: *"When working in the claudepanion repo with MCP tools available, call `<slug>_list` for relevant companions to see if there is pending work."*
- Pointer: *"Each companion has its own SKILL.md — follow it when engaged with that companion's work."*

**`skills/build/SKILL.md`** — triggered when Build work is active. Describes:
- The companion file layout (authoritative copy in `docs/companion-contract.md`).
- How to choose a slug; what manifest fields mean.
- What each tool should do for the standard polling pattern.
- How to design the UI page (layout provided by platform; `renderPage` returns body HTML).
- Where to write the companion skill (plugin root, not inside the companion dir).
- Reminder to include a restart note in the completion summary when the server is not in dev mode.

Future companions scaffolded by Build each ship their own `skills/<slug>/SKILL.md`.

### Error handling for Build flow

| Failure mode | Handling |
|--------------|----------|
| Claim on already-claimed request | Optimistic version check fails; second claimer gets a clear error. |
| Orphaned `running` request (Claude session died) | UI shows "stuck > 5min?" banner with "Reset to pending" button (`POST /api/c/build/requests/:id/reset`). |
| Build fails mid-work | Claude calls `build_complete({ id, error: '...' })`. Status → `failed`, UI renders the error. |
| File-write collision | Path collision check during staging; if detected, status → `failed` with clear message. User picks a different slug. |
| No active Claude session | Request pending > 2 min → UI hint: *"No active Claude Code session detected. Open Claude Code in the claudepanion repo."* |

---

## 4. Human-facing surface — UI, routing, data

### URL routing

| Route | Purpose |
|-------|---------|
| `GET /` | Redirect to first companion alphabetically (`/c/build` at clone time). |
| `GET /c/<slug>` | Platform layout + companion's `renderPage(ctx)` body HTML. |
| `GET /events` | SSE stream for UI live-updates. |
| `POST /api/c/<slug>/*` | Companion-owned REST routes (from optional `routes.ts`). |
| `GET /mcp`, `POST /mcp`, `DELETE /mcp` | MCP endpoint (existing). |
| `GET /api/health` | Platform health ping. Includes per-companion load status. |

No platform-generic CRUD endpoints. Companions own their REST surface via `routes.ts`.

### UI shape

- **Layout (platform-provided).** Left sidebar with company logo and companion list. Main content area. SSE wired globally. Toast helper.
- **`renderPage(ctx)`** returns companion's main-content HTML as a string. Companions can include `<script>` blocks; they have access to platform-provided globals (`api()`, `EventSource` already open at `/events`, `showToast()`).
- **No "+ New Companion" button.** Build *is* the new-companion flow, so it lives in the nav like any companion.
- **Nav footer** shows MCP endpoint URL, server version, dev-mode indicator.
- **Errored companions** appear in nav with a red-dot indicator; clicking shows the error and points at the offending file.

### SSE event conventions

- All events flow through the single `/events` stream.
- Event names follow `<slug>.<verb>`. For Build: `build.request_created`, `build.request_updated`, `build.log_appended`.
- Companion-scoped browser scripts listen for their own events:
  ```js
  sse.addEventListener('build.log_appended', (e) => { /* append to DOM */ });
  ```
- Platform reserves `platform.*` events for host-level signals (version change, server shutdown).

### Data layout

- One JSON file per companion, at `data/<slug>.json`. Convention; companions can use `data/<slug>/` for multi-file state if needed.

**`data/build.json` shape:**

```json
{
  "requests": [
    {
      "id": "uuid",
      "version": 3,
      "status": "pending | running | done | failed",
      "description": "user's prompt text",
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601",
      "logs": [{ "at": "ISO-8601", "message": "..." }],
      "result": {
        "summary": "# Scaffolded `oncall` companion\n\n...markdown...",
        "files": [{ "path": "companions/oncall/manifest.json", "bytes": 234 }]
      },
      "error": null
    }
  ]
}
```

- `data/` contents are gitignored. Directory kept with `.gitkeep`.
- Writes are atomic: tmp + fsync + rename.
- `version` field supports optimistic concurrency for claim races.

### Request-store helper

Because the polling-style companion pattern repeats, ship one shared helper:

```ts
// src/helpers/requestStore.ts
export function createRequestStore(slug: string): {
  list(): Promise<Request[]>;
  get(id: string): Promise<Request | null>;
  create(description: string): Promise<Request>;
  claim(id: string, expectedVersion: number): Promise<Request>;
  log(id: string, message: string): Promise<void>;
  complete(id: string, result: { summary: string; files: FileRef[] }): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  reset(id: string): Promise<void>;
  buildRouter(): Router;    // returns Express routes for standard endpoints
};
```

Companions following the polling pattern call `createRequestStore(slug)` and re-export the router. Companions with different shapes ignore it. This is the *only* shared abstraction — explicit, opt-in.

**Build is the canonical consumer.** `companions/build/store.ts` is a one-liner re-exporting `createRequestStore('build')`; `companions/build/routes.ts` re-exports `.buildRouter()`. Build's four `tools/*.ts` files are thin MCP-tool wrappers around the helper's store methods (read, claim, log, complete). This keeps Build's code at pattern purity and makes the helper's usage self-documenting — reading `companions/build/` is the reference for anyone writing a polling-pattern companion from scratch.

### First-run UX

- Land on `/c/build`.
- Textbox placeholder: *"A companion that reads a URL and produces a markdown summary."*
- Dismissible info strip below the textbox: *"Claudepanion works by having Claude Code (in this repo) pick up work you submit here. Make sure a Claude Code session is running with claudepanion enabled."*
- After submit: pending card shows immediately; if no claim within 2 minutes, inline hint about opening Claude Code.

---

## 5. Housekeeping

### Rename mechanics

Single atomic commit after the strip + scaffold work is complete. In scope:

- Repo directory: `claude-manager` → `claudepanion`
- `package.json` `name`
- CLI binary: `bin/claudepanion` (delete old `bin/claude-manager`)
- Plugin identifiers: `plugin.json`, `marketplace.json`, `McpServer({ name: 'claudepanion' })`
- `.mcp.json` server key: `"claudepanion"`
- Skill directory: `skills/use-claude-manager-mcp/` → `skills/use-claudepanion/`
- All README/doc prose, nav logo text

### Dev mode vs. serve

- `claudepanion dev` — wraps `tsx watch src/server.ts`. File changes auto-restart, including new companions scaffolded by Build. Expected mode during active companion development.
- `claudepanion serve` — production mode, no watch. Build's completion summary includes restart reminder.
- **MCP `tools/list_changed`.** On server restart in dev mode, emit `notifications/tools/list_changed` on existing MCP sessions so Claude Code re-calls `tools/list` and picks up new companion tools without restarting Claude. If emission is unreliable in practice, manual Claude restart is the documented fallback.

### Platform-level error handling

| Condition | Handling |
|-----------|----------|
| Companion load failure (missing manifest, bad export, duplicate slug, malformed JSON) | Log structured error to stderr, skip companion, continue. Health endpoint reports failure; nav shows error indicator. |
| Concurrent claim races | Optimistic version check in `requestStore.claim()`. Second claimer gets conflict error. |
| Atomic file writes | All writes tmp+fsync+rename. `build_complete` stages files in `.claudepanion-stage-<uuid>/` and moves atomically; failure leaves state untouched. |
| SSE transport errors | Existing heartbeat + disconnect cleanup. No change. |
| Path traversal in `build_complete` files | Reject any path not under `companions/<slug>/` or `skills/<slug>/`. |

No authentication, no CORS hardening. Localhost-only. Documented as non-goal in README.

### Testing strategy

- **Framework:** vitest (add it). Fast, minimal config, works with tsx and native ESM.
- **Unit tests**
  - `storage.ts` — atomic writes, corruption recovery, missing-file creation.
  - `companions.ts` — discovery, slug validation, malformed-manifest rejection.
  - `helpers/requestStore.ts` — CRUD, status transitions, concurrent claim races.
- **Integration tests** (`tests/integration/`)
  - MCP lifecycle — initialize, list tools, call a tool, verify SSE broadcast, session cleanup on DELETE.
  - Build flow end-to-end — `POST /api/c/build/requests` → `build_claim` → `build_log` → `build_complete` with staged files. Assert files land in correct place, `data/build.json` updated, SSE events fire in correct order.
- **No browser/UI tests on day one.** SRH responses covered via integration-test assertions on HTML content. Add Playwright later if coverage gaps surface.
- Tests use per-test temp directories set via `CLAUDEPANION_DATA_DIR` and `CLAUDEPANION_COMPANIONS_DIR` environment variables so real user data is untouched.

### Docs

- `README.md` — lean. What is this / quick start / how to use Build / companion contract overview / links to deeper docs.
- `docs/architecture.md` — MCP lifecycle, stateful transport, SSE design, session mechanics. Current README internals move here.
- `docs/companion-contract.md` — authoritative companion spec: file layout, required exports, event conventions, request-store helper API. This is the file `skills/build/SKILL.md` points Claude at when scaffolding.
- `docs/troubleshooting.md` — common issues (no claim, stuck running, tools not visible, port conflict).

### Migration

Clean break from `claude-manager`. No migration tooling. Existing `data/tasks.json` and `data/skills/*.md` from pre-pivot runs will be discarded by the implementation.

---

## 6. Open questions / deferred

- **Companion icons.** `manifest.json` allows optional `icon`; initial implementation uses a unicode glyph (`✦`, `⚡`, etc.). Richer icon support (SVG, lucide) deferred.
- **MCP resource exposure.** Potentially expose companion SKILL.md files as MCP resources for richer discoverability. Not on day one.
- **Concurrent Claude sessions.** Design assumes one Claude Code session processes requests at a time. Two simultaneous claimers work correctly via version checks, but no UX exists to indicate "someone else is working on this." Document as known behavior; revisit only if it becomes a problem.
- **Port conflict fallback.** Default port 3000; if in use, fail loudly and instruct user to `PORT=3001 claudepanion serve`. No auto-pick.

---

## 7. Implementation phases (reference for plan)

The design implies these broad phases. The implementation plan (next step) will decompose further.

1. **Scaffold platform primitives.** `src/companions.ts` (discovery), `src/helpers/requestStore.ts`, `src/types.ts`, `CompanionContext`, updated `src/server.ts` routing. Tests for each.
2. **Strip tasks + skills.** Remove `src/mcp/tools/tasks-*`, `src/mcp/tools/skills-*`, `src/store.ts` task/skill logic, `src/ui/tasksPage.ts`, `src/ui/skillsPage.ts`, related REST routes.
3. **Build the Build companion.** `companions/build/` with manifest, 4 tools, ui, store, routes. `skills/build/SKILL.md`. Platform meta-skill `skills/use-claudepanion/SKILL.md`.
4. **Dev mode + CLI.** Update `bin/claudepanion` with `dev` / `serve` / `plugin install` / `plugin uninstall`. Wire `tools/list_changed` notification on restart.
5. **Rename.** Single commit renaming all identifiers to `claudepanion`.
6. **Docs.** Rewrite README, split out `architecture.md`, write `companion-contract.md` and `troubleshooting.md`.
7. **Tests.** vitest harness + unit + integration coverage.
