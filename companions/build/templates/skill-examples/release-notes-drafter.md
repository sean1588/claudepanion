---
name: __NAME__-companion
description: Use when the user pastes "/__NAME__-companion <entity-id>" — drafts user-facing release notes from merged PRs in a git range.
---

# /__NAME__-companion <entity-id>

Draft user-facing release notes. Read the git range, pull merged PR metadata, group by type, produce a markdown changelog.

> **CRITICAL — MCP tools ONLY:**
> - All state changes go through `mcp__claudepanion__`__NAME___*` tools.
> - NEVER curl `/api/entities/*`. NEVER edit `data/__NAME__/*.json`.
> - On any MCP error: `mcp__claudepanion__`__NAME___fail`` and stop.

## Step 1 — Load the entity

```
mcp__claudepanion__`__NAME___get`({ id: "<entity-id>" })
```

`entity.input.description` should carry a git range and optional tone guidance. Expected shapes:
- `"v0.4.0..HEAD"` — explicit range
- `"since v0.4.0"` — we'll translate to `v0.4.0..HEAD`
- A date range: `"since 2026-04-01"` — translate with `git log --since=...`

Optional tone: "terse", "marketing-friendly", "dev-focused". If absent, default to dev-focused.

If the range doesn't parse, ask the user to clarify.

## Step 2 — Mark running

```
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "running", statusMessage: "collecting commits" })
```

## Step 3 — Collect commit + PR data

Use Bash. Two data sources:

1. `git log --oneline --no-merges <range>` — the flat commit list.
2. If the repo is on GitHub and `gh` is available: `gh pr list --state merged --search 'merged:>=<start-date>'` (or iterate with `--search '<sha>'` per commit) to get PR titles, labels, and bodies. PR bodies often have sentence-level summaries that make better release notes than commit subjects.

Log progress:

```
mcp__claudepanion__`__NAME___append_log`({ id: "<entity-id>", message: "collected <N> commits / <M> PRs" })
```

## Step 4 — Group by type

Classify each commit/PR into one of the sections below. Use commit message conventions (Conventional Commits) if present; otherwise infer from the diff or PR labels.

- **New features** — additions of user-visible functionality.
- **Fixes** — bug fixes users would care about.
- **Breaking changes** — anything that requires migration on the consumer side. Always call these out first.
- **Internals** — refactors, deps bumps, CI changes. Keep terse; often worth a single "Internals: 12 commits" rather than listing each.
- **Docs** — user-facing docs changes only. Internal docs go under Internals.

## Step 5 — Draft the markdown

Produce sections in this order: Breaking → Features → Fixes → Internals. Omit empty sections.

Each bullet is one sentence, user-facing voice, starts with a verb. Avoid "refactored" or "cleaned up" unless it has a user-visible effect. Include PR numbers in parentheses: `(#123)`.

If a tone was specified, apply it consistently. "Terse" = one-liner per bullet, no adjectives. "Marketing-friendly" = one sentence of context before the sections. "Dev-focused" = default, blunt.

## Step 6 — Save artifact + complete

```
mcp__claudepanion__`__NAME___save_artifact`({
  id: "<entity-id>",
  artifact: {
    summary: "<the full markdown release notes>"
  }
})

mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "completed" })
```
