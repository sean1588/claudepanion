---
name: grounding-companion
description: Use when the user pastes "/grounding-companion <entity-id>" — reads the claudepanion architecture docs and produces a narrative orientation briefing.
---

# /grounding-companion <entity-id>

Produce a narrative architecture briefing for a claudepanion session.

> **CRITICAL — MCP tools ONLY:**
> - All state changes go through `mcp__claudepanion__grounding_*` tools.
> - NEVER curl `/api/entities/*`. NEVER edit `data/grounding/*.json`.
> - On any MCP error: `mcp__claudepanion__grounding_fail` and stop.

## Step 1 — Load entity

```
mcp__claudepanion__grounding_get({ id: "<entity-id>" })
```

Note `entity.input.focus` — may be undefined (full overview) or a string like `"plugin system"`.

## Step 2 — Mark running

```
mcp__claudepanion__grounding_update_status({ id: "<entity-id>", status: "running", statusMessage: "reading docs" })
```

## Step 3 — Read the three architecture docs

Read all three files in full using the Read tool:

1. `grounding.md` — meta-reference: the thesis, companion model, end-to-end flow, key rules not to repeat.
2. `reference-architecture.md` — technical reference: plugin wiring, MCP session lifecycle, tool registration, data layer, REST surface, skills convention.
3. `docs/concept.md` — Notion-authored thesis: why the project exists, ten companion elements, owned tensions.

```
mcp__claudepanion__grounding_update_status({ id: "<entity-id>", status: "running", statusMessage: "synthesizing" })
```

## Step 4 — Synthesize the briefing

Write a markdown narrative with these four sections. If `entity.input.focus` is set, open by acknowledging it and weight that topic throughout — telescope the other three sections to 1–2 sentences each.

### Section 1: The thesis (one paragraph)

Why claudepanion exists — the economic claim (AI collapsed the cost of specialized software), the architectural bet (agent as the backend, not inside the product), what it's NOT (not CopilotKit, not LangChain, not chat UI).

### Section 2: How the pieces connect

Prose walkthrough of the live path:
- `claudepanion plugin install` → writes `enabledPlugins["claudepanion@local"]` + `extraKnownMarketplaces` to `.claude/settings.local.json` in the target repo.
- New Claude Code session reads it → connects to `http://localhost:3001/mcp` (Streamable HTTP, one transport per `initialize` request, `Mcp-Session-Id` header on subsequent calls).
- Skills at `skills/<name>/SKILL.md` (nested, literal filename) load as slash commands.
- User fills a companion's form → `POST /api/entities` writes a JSON file to `data/<companion>/<id>.json`.
- User pastes the slash command → Claude calls `mcp__claudepanion__*` tools to update entity state.
- UI polls `/api/entities/:id?companion=<name>` every 2s → renders state morphs (pending/running/completed/error).
- Watcher (chokidar on `companions/*/manifest.ts`) fires on file changes → debounce → re-import → `registry.remount()` → no server restart.

### Section 3: The key rules

Bullet list — the things most likely to trip a fresh session:

- Plugin installs to `.claude/settings.local.json` (not `.mcp.json`).
- Skills must be at `skills/<name>/SKILL.md` — nested, literal `SKILL.md`. Flat files are NOT discovered by Claude Code's plugin loader.
- `__PASCAL__` for type/component names; `__CAMEL__` for variable bindings.
- Register new companions in BOTH `companions/index.ts` AND `companions/client.ts` — missing `client.ts` causes "No form registered."
- Generic entity tools (`_get/_list/_update_status/_append_log/_save_artifact/_fail`) auto-register; `companions/client.ts` is for React renderers.
- The watcher re-imports from `dist/companions/<name>/index.js` — a rebuild is required for changes to be picked up in the running server.

### Section 4: Where to go for depth

| Topic | Pointer |
|---|---|
| Plugin wiring mechanics | `reference-architecture.md §2–4` |
| MCP Streamable HTTP session lifecycle | `reference-architecture.md §4b` |
| Tool registration pattern | `reference-architecture.md §4c` |
| Companion contract (files per kind) | `docs/superpowers/specs/2026-04-22-claudepanion-ux-redesign-design.md §Companion contract` |
| Deferred work | `docs/followups.md` |
| Implementation history | `docs/superpowers/plans/` (Plans 1–7 + onboarding + skill hardening) |

## Step 5 — Save artifact + complete

```
mcp__claudepanion__grounding_save_artifact({
  id: "<entity-id>",
  artifact: { briefing: "<the full markdown narrative>" }
})

mcp__claudepanion__grounding_update_status({ id: "<entity-id>", status: "completed" })
```

On any error at any step:

```
mcp__claudepanion__grounding_fail({ id: "<entity-id>", errorMessage: "<short cause>" })
```
