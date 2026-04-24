---
name: __NAME__-companion
description: Use when the user pastes "/__NAME__-companion <entity-id>" — reads a repo and writes a "how to get oriented" doc for new contributors.
---

# /__NAME__-companion <entity-id>

Walk the repo at the user's cwd and produce a "how to get oriented" markdown doc for someone joining the codebase.

> **CRITICAL — MCP tools ONLY:**
> - All state changes go through `mcp__claudepanion__`__NAME___*` tools.
> - NEVER curl `/api/entities/*`. NEVER edit `data/__NAME__/*.json`.
> - On any MCP error: `mcp__claudepanion__`__NAME___fail`` and stop.

## Step 1 — Load the entity

```
mcp__claudepanion__`__NAME___get`({ id: "<entity-id>" })
```

`entity.input.description` may carry a repo path, focus areas ("server side only", "frontend only"), or target audience ("new junior engineer", "senior IC transitioning stacks"). If empty, assume cwd + general-purpose.

## Step 2 — Mark running

```
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "running", statusMessage: "walking repo" })
```

## Step 3 — Breadth-first scan

Use Bash + Read + Grep. In order:

1. Read the top-level README if present. Note the stated purpose and quickstart.
2. `ls` the repo root to catalog top-level dirs and config files (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `Makefile`, `.github/workflows`, etc.).
3. Read any `package.json` or equivalent — note dependencies, scripts, and the `bin` entry if present.
4. Read CONTRIBUTING.md, ARCHITECTURE.md, or any `docs/` landing doc.
5. For each major top-level dir, read one or two representative files to understand the layer's responsibility. Prefer entry points (`src/index.*`, `src/main.*`, `cmd/...`) and configuration.

After each major dir scanned:

```
mcp__claudepanion__`__NAME___append_log`({ id: "<entity-id>", message: "scanned <dir>" })
```

## Step 4 — Deep-dive on entry points

Identify 2–3 entry points that cover the main execution paths (e.g. the CLI entry, the HTTP server bootstrap, the test runner config). Read those files fully. Trace one key code path through — e.g. "a request arrives at `server.ts`, is routed to `routes/*`, handlers use `db/*`."

## Step 5 — Draft the doc

Structure:

```markdown
# Getting Oriented: <repo name>

## What this repo does

[One paragraph — the actual purpose, not a restatement of the README.]

## Where to start reading

[3–5 files that would give a newcomer the best mental model fastest, in reading order.]

## Key concepts

[Domain vocabulary, architectural patterns, anything a reviewer would need to understand the diffs.]

## Development workflow

[How to install deps, build, run tests, run locally. Pulled from package.json scripts + CONTRIBUTING.]

## Testing

[Where tests live, how to run one, what the coverage expectations are.]

## Common gotchas

[Things a new contributor would trip over: odd file-layout conventions, required env vars, manual-setup steps not in the quickstart.]
```

Write it in plain voice. Avoid marketing language. If you had to guess at something because the code didn't tell you, mark it with `> ❓` so the user knows to verify.

## Step 6 — Save artifact + complete

```
mcp__claudepanion__`__NAME___save_artifact`({
  id: "<entity-id>",
  artifact: {
    summary: "<the full markdown onboarding doc>"
  }
})

mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "completed" })
```
