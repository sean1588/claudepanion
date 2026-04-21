---
name: use-claudepanion
description: Always-on meta-skill for the claudepanion plugin — explains the companion pattern and directs Claude to check pending work via MCP when working in the claudepanion repo.
---

# Use Claudepanion

When the `claudepanion` MCP server is connected, it exposes tools from one or more **companions** — small web apps whose work Claude Code performs on behalf of the user. Each companion owns a tool group, all prefixed with the companion's slug:

- `<slug>_list` — pending / running / completed work items
- `<slug>_claim` — move a pending item to running (requires current version)
- `<slug>_log` — append a live progress line (streams to UI)
- `<slug>_complete` — finish the work, produce an artifact

## When you're working in the claudepanion repo

1. At session start, consider calling `build_list` (and any other companion's `_list`) to see if the user has submitted pending work through the UI.
2. When you claim work, stream progress with `<slug>_log` — the user is watching the browser.
3. Each companion has its own `SKILL.md` at `skills/<slug>/SKILL.md` — **read it when you're engaged with that companion's work**. It describes the companion's expected behavior and any domain-specific constraints.

## When you're working in a different repo that has claudepanion installed

You'll see the same tools, but submitting / watching requests happens in the browser UI served by the user's claudepanion server. Treat the tools the same way.

## Boundaries

- Every companion tool writes data under `data/<slug>.json` via the request-store helper. Don't attempt direct disk writes to `data/` from outside a tool handler.
- File-writing tools (e.g. `build_complete`) only allow paths under `companions/<slug>/` and `skills/<slug>/`. This is enforced server-side; don't try to bypass.
- If you're unsure whether to claim a request, ask the user first — the request author may not have finalized their intent.
