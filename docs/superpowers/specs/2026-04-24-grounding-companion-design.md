# Grounding Companion — Design Spec

**Date:** 2026-04-24
**Status:** Draft for implementation

## Goal

A claudepanion entity companion that reads the architecture docs and produces a concise narrative briefing. Intended as session-start orientation for Claude Code sessions working on claudepanion itself — "remind me how the pieces fit."

## Non-goals

- Status tracking (what's been shipped, what's open) — that's a separate future companion.
- Real-time git introspection or PR summaries.
- A permanent wiki or living document — each run is a snapshot artifact.

---

## Companion shape

| Field | Value |
|---|---|
| Slug | `grounding` |
| Kind | `entity` |
| Display name | `Grounding` |
| Icon | 🧭 |
| Description | `Reads the claudepanion architecture docs and produces a narrative orientation briefing.` |
| Contract version | `1` |

### Input

```ts
interface GroundingInput {
  focus?: string;  // Optional. "plugin system", "MCP wiring", "companion contract", etc.
                   // If omitted, produces a full-spectrum overview.
}
```

### Artifact

```ts
interface GroundingArtifact {
  briefing: string;  // Markdown narrative.
}
```

---

## Form

Single optional textarea field: "Focus area (optional)". Placeholder: `e.g. "plugin system" or "companion contract"`. Leave blank for a full overview.

The form should use a `<textarea>` (not a single-line `<input>`) since focus descriptions can be a phrase or a sentence.

---

## Detail page

`Detail.tsx` renders `entity.artifact.briefing` as markdown using `react-markdown`. This is the primary value of the artifact — it should be readable prose, not a raw preformatted block.

`react-markdown` is not currently installed. It is a dependency of this companion and should be added when the companion is scaffolded.

---

## Skill — `skills/grounding-companion/SKILL.md`

### Trigger

`/grounding-companion <entity-id>`

### What the skill reads

Three files, always in full:

1. `grounding.md` — the meta-reference doc: thesis, companion model, end-to-end flow, rules not to repeat.
2. `reference-architecture.md` — the detailed technical reference: plugin wiring mechanics, MCP session lifecycle, tool registration, data layer, REST surface, skills filesystem convention.
3. `docs/concept.md` — the Notion-authored thesis: why this project exists, the ten companion elements, architectural bets, owned tensions.

### What it produces

A narrative briefing in four parts:

1. **The thesis** (one paragraph) — why claudepanion exists, the economic claim, the architectural bet ("agent is the backend").

2. **How the pieces connect** — prose walkthrough of the full live path: `claudepanion plugin install` writes `enabledPlugins` + `extraKnownMarketplaces` to `.claude/settings.local.json` → new Claude Code session reads it → MCP server at `localhost:3001/mcp` connects (Streamable HTTP, per-initialize sessions) → skills at `skills/<name>/SKILL.md` load as slash commands → user fills form → entity JSON written → user pastes slash command → Claude calls MCP tools to update entity state → UI polls → artifact renders.

3. **The key rules** — the "things I've gotten wrong before" section from `grounding.md`, condensed to a bullet list. These are the rules most likely to trip a fresh session (e.g. skills must be nested `SKILL.md`, plugin installs `.claude/settings.local.json` not `.mcp.json`, `__PASCAL__` for types, both `index.ts` and `client.ts` must be registered).

4. **Where to go for depth** — a short pointer table: "for plugin mechanics → `reference-architecture.md §2–4`; for MCP session lifecycle → `§4b`; for companion contract → the design spec; for deferred work → `docs/followups.md`."

### Focus area handling

If `entity.input.focus` is set, the skill:
- Opens the briefing by acknowledging the focus: "You asked specifically about `<focus>`. Here's the relevant architecture..."
- Weights that topic throughout — spends proportionally more words on it.
- Still includes all four sections but telescopes the non-focus sections to 1–2 sentences each.

### Skill step sequence

1. `mcp__claudepanion__grounding_get({ id })` — load entity.
2. `mcp__claudepanion__grounding_update_status({ id, status: "running", statusMessage: "reading docs" })`.
3. Read `grounding.md`, `reference-architecture.md`, `docs/concept.md` in full.
4. `mcp__claudepanion__grounding_update_status({ id, status: "running", statusMessage: "synthesizing" })`.
5. Synthesize the four-part narrative (focus-weighted if `entity.input.focus` is set).
6. `mcp__claudepanion__grounding_save_artifact({ id, artifact: { briefing: "<markdown>" } })`.
7. `mcp__claudepanion__grounding_update_status({ id, status: "completed" })`.

---

## Files

| Path | Notes |
|---|---|
| `companions/grounding/manifest.ts` | slug, kind, icon, description |
| `companions/grounding/types.ts` | `GroundingInput`, `GroundingArtifact` |
| `companions/grounding/index.ts` | re-exports manifest + tools |
| `companions/grounding/form.tsx` | single optional textarea |
| `companions/grounding/pages/List.tsx` | row shows focus area (or "Full overview" if blank) + created-at |
| `companions/grounding/pages/Detail.tsx` | renders `briefing` via react-markdown |
| `companions/grounding/server/tools.ts` | empty (no domain tools) |
| `skills/grounding-companion/SKILL.md` | the full playbook |
| `companions/index.ts` | add grounding import + array entry |
| `companions/client.ts` | register Detail/List/Form |
| `package.json` | add `react-markdown` dependency |

---

## Success criteria

- User opens `/c/grounding`, clicks `+ New`, submits with no focus area.
- Pending page shows the slash command.
- Running the skill produces a completed artifact with all four narrative sections present.
- Artifact renders as formatted markdown (not raw text) on the detail page.
- With a focus area ("plugin system"), the briefing opens with plugin context and weighs it proportionally.
- The companion itself is deleted cleanly via `claudepanion companion delete grounding` (validates the delete command we just shipped).
