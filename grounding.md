# Grounding

> **If you're Claude Code opening this repo for the first time in a new session: read this file first.** It exists so every session starts from the same point, with the thesis, the architectural model, and the hard-won rules all in one place.

This doc doesn't replace the source-of-truth documents — it points at them and consolidates the context you need to hold in working memory.

---

## The three source documents

These three docs are the ground truth. Re-read them directly when the details matter.

1. **[`docs/concept.md`](./docs/concept.md)** — the Notion-authored thesis & vision. What claudepanion is philosophically, why it exists, and the tensions we've chosen to own. Start here for "why are we building this."

2. **[`docs/superpowers/specs/2026-04-22-claudepanion-ux-redesign-design.md`](./docs/superpowers/specs/2026-04-22-claudepanion-ux-redesign-design.md)** — the architectural design spec that guided Plans 1–7. How the system is structured: kinds, contracts, manifest, MCP surface, detail-page states, installer. Start here for "how is it built."

3. **[`reference-architecture.md`](./reference-architecture.md)** — the authoritative reference from the oncall-investigator precedent. How a Claude Code plugin actually works (plugin.json, marketplace.json, `.claude/settings.local.json`, `skills/<name>/SKILL.md`), how MCP Streamable HTTP sessions are mounted, how the REST/MCP split plays out on one port. Start here for "which file goes where and why."

**When you're unsure about a detail, prefer the specific doc over this one.** This doc paraphrases; those three are precise.

---

## The thesis (from `docs/concept.md`)

> Claudepanion is an AI-native framework for building personal software with Claude Code.

The economic claim: specialized software used to be expensive, so everyone settled for general-purpose SaaS. AI collapsed that cost. The next generation of tools isn't shipped — it's *scaffolded*, by an agent, on demand, for an audience of one.

The architectural claim: existing AI frameworks put an agent inside an app. Claudepanion inverts that. **The agent is the backend.** The human is a browser-UI user. The framework is designed so the agent can extend itself — the Build companion is the self-replicating primitive that makes the marginal cost of a new personal tool approximately "type a paragraph and wait."

The scope claim: one localhost process, one URL, many small personal apps. Single-user localhost only — no auth, no multi-tenancy, no marketplace (for now). Claude-native, full stop — the side door for non-Claude agents is a side door, not a feature.

---

## The companion concept — what you're building on top of

A **companion** is a small app living inside the claudepanion host. Every companion has (or can have) ten elements, documented in `docs/concept.md § "What a companion is"`. The load-bearing ones:

- A **form** that produces an **entity** (stable ID like `inv-abc123` or `build-f05218`).
- A **slash command** like `/build-companion <id>` — the explicit, imperative handoff from UI to Claude.
- A **skill** — the markdown playbook at `skills/<name>-companion/SKILL.md` that becomes the slash command's body. This is where the intelligence of each companion lives.
- **MCP tools** the server exposes. The host auto-registers six generic ones per entity companion (`<name>_get/_list/_update_status/_append_log/_save_artifact/_fail`); companions add their own domain tools alongside.
- A **detail page** per entity with a live log tail polled every 2s.
- **Per-entity JSON storage** at `data/<companion>/<entity-id>.json`. No database, portable, shareable.
- A **plugin manifest** (`.claude-plugin/plugin.json`) + **`.mcp.json`** so Claude Code can discover the MCP server and skills via a single install step.

Two companion kinds:
- `entity` — has lifecycle (pending → running → completed | error), form, list page, detail page, artifact.
- `tool` — MCP tools only, no lifecycle. The host auto-generates an About page with a Try-it panel from `defineTool`-annotated handlers.

---

## How a run actually flows (condensed)

End-to-end trace, spelled out in full in `reference-architecture.md § 9`:

1. User fills the form in the browser → `POST /api/entities` creates a JSON file → entity is `pending`.
2. Detail page shows a slash command like `/build-companion build-f05218`.
3. User pastes that into Claude Code (in a repo where the claudepanion plugin is installed + session started after install).
4. Claude matches the slash command to `skills/build-companion/SKILL.md`, loads the playbook, starts executing.
5. Every tool call the skill specifies (`build_get`, `build_update_status`, `build_append_log`, etc.) hits the MCP server at `http://localhost:3001/mcp` over Streamable HTTP, with a `Mcp-Session-Id` header threading through the session.
6. Each call updates the JSON file. The UI polls `/api/entities/:id` every 2s and re-renders.
7. On completion, the skill calls `build_save_artifact` + `build_update_status("completed")`. The detail page morphs from `running` to `completed` and renders the artifact.
8. User can hit **Continue** to flip back to `pending` with the prior artifact preserved as context, generating a new slash command.

**Two bright lines:** The UI reads via REST; the agent writes via MCP. Both read/write the same per-entity JSON file.

---

## Rules I've repeatedly gotten wrong — don't repeat

These are the mistakes that wasted cycles. Internalize them.

### 1. `.claude/settings.local.json` is where plugins are registered — not `.mcp.json`

`.mcp.json` declares MCP servers. It's read automatically when Claude Code starts in a directory with that file. It does **not** register the plugin, and it does **not** load skills.

Plugin registration is done via two keys in `<repo>/.claude/settings.local.json`:
- `enabledPlugins["claudepanion@local"] = true`
- `extraKnownMarketplaces.local = { source: { source: "directory", path: <abs-path-to-claudepanion> } }`

The CLI `claudepanion plugin install` writes these. Verify with `/plugin` in Claude Code — `claudepanion@local` should appear.

Details: `reference-architecture.md § 2`, `§ 3`, `§ 10`.

### 2. Skills must live at `skills/<name>/SKILL.md` — nested, literal filename `SKILL.md`

Claude Code's plugin loader will not find a flat `skills/<name>.md`. This was the original bug that broke the onboarding session.

### 3. The oncall-investigator repo is the reference — consult it, don't improvise

Path: `/home/sean/projects/oncall-investigator`. When you're unsure how a piece of the stack should look (CLI, plugin, MCP mount, tool pattern, data store, REST routes, UI shell), open that repo and match its pattern. `reference-architecture.md` distills what it does — but the source is still more authoritative when in doubt.

### 4. Don't default to HTML template strings for a UI-centric app

(From user memory.) When building UI-centric features, use a real frontend framework. Claudepanion uses React 18 + Vite 6 + react-router-dom v6. Don't regress.

### 5. Slash commands over session-start polling

The concept doc's earlier iterations tried "consider calling X at session start." That's unreliable. Every handoff from UI to agent goes through an explicit slash command. There is no "maybe Claude checks." The user types the command; Claude executes. Don't bring back soft-cue hacks.

### 6. Prefer editing existing files over creating new ones; don't add layers for hypotheticals

(From CLAUDE.md-level guidance.) Plan 7's best contribution wasn't the features; it was the consolidation. Before adding a new module, ask whether an existing one can absorb the change.

---

## What's shipped vs. deferred

**Shipped through Plans 1–7 + onboarding + plugin migration (PR merged into main + feat/build-onboarding open):**

- React + Vite + Express + MCP Streamable HTTP host on one port.
- Per-entity JSON storage with the four state morphs (`pending` / `running` / `completed` / `error`).
- Generic MCP tool auto-registration per entity companion.
- `kind: "tool"` companions with `defineTool` metadata + auto-generated About page with Try-it.
- Build companion with `new-companion` and `iterate-companion` modes + templates.
- `/install` flow for npm-distributed companions with registry persistence.
- Contract validator + smoke test runner + chokidar watcher for soft re-mount.
- `claudepanion` CLI with `serve` + `plugin install/uninstall` — now correctly registering via `.claude/settings.local.json`.
- Build first-run onboarding: welcome block, 5 example chips, prefill-via-`?example=` query param.
- CI workflow with lint + typecheck + test + build gates on PRs.
- Lighthouse accessibility score 100.

**Deferred (tracked in [`docs/followups.md`](./docs/followups.md)):**

- Onboarding polish ideas (Surprise-me button, empty-state chips, prompt-editor).
- Vision gaps: real external-proxy companion shipped, cross-companion composition, `/install-companion` as a skill, validator/smoke CLIs.
- UI polish: pulsing pill, artifact header actions, logs collapse, last-visited landing, alphabetical sidebar.
- Dev-mode ergonomics: `tsc --watch` in `npm run dev`.

---

## Where to go when stuck

| You're doing | Open |
|---|---|
| "Why does this product exist?" | `docs/concept.md` § Pitch + Thesis |
| "How is a companion structured on disk?" | Design spec § Companion contract + `reference-architecture.md` § 1, § 8 |
| "How does a skill get loaded?" | `reference-architecture.md` § 2 + § 3 + § 8 |
| "How does Claude talk to the server?" | `reference-architecture.md` § 4b + § 4c |
| "How does an entity flow through states?" | Design spec § Detail page — four states |
| "Why is the install command the way it is?" | `reference-architecture.md` § 3, § 11 |
| "What's known-open and might be worth picking up?" | `docs/followups.md` |
| "What's the history of how we got here?" | Plans at `docs/superpowers/plans/` (chronological, roughly) |
