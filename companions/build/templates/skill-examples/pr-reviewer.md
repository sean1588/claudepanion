---
name: __NAME__-companion
description: Use when the user pastes "/__NAME__-companion <entity-id>" — reviews a pull request and produces a structured review artifact.
---

# /__NAME__-companion <entity-id>

Review one pull request end-to-end. Walk the diff, flag risks, suggest review questions, produce a durable review artifact.

> **CRITICAL — MCP tools ONLY:**
> - All state changes go through `mcp__claudepanion__`__NAME___*` tools.
> - NEVER curl `/api/entities/*` to mutate. NEVER edit `data/__NAME__/*.json` directly.
> - On any MCP error: `mcp__claudepanion__`__NAME___fail`` and stop.

## Step 1 — Load the entity

```
mcp__claudepanion__`__NAME___get`({ id: "<entity-id>" })
```

`entity.input.description` carries the PR reference. Expected shapes:
- `"#123"` or `"PR 123"` — a PR number in the current repo
- A branch name — the local branch containing the changes
- A full GitHub URL — `https://github.com/owner/repo/pull/123`

Optional follow-up guidance may be appended ("check error paths", "be strict on perf", "focus on security"). Treat that as review focus.

If the reference is ambiguous or missing, ask the user for clarification before proceeding — don't guess.

## Step 2 — Mark running

```
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "running", statusMessage: "fetching diff" })
```

## Step 3 — Fetch the diff

Prefer `gh pr diff <ref>` via the Bash tool if the target is a GitHub PR and the `gh` CLI is available. Otherwise `git diff <base>..<head>` against the local branch. If neither is possible, fail:

```
mcp__claudepanion__`__NAME___fail`({ id: "<entity-id>", errorMessage: "could not obtain diff (gh unavailable and branch ref not found)" })
```

## Step 4 — Walk the changed files

```
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "running", statusMessage: "reviewing files" })
```

For each changed file in the diff:

1. Read the file at its new version (via Read) so you see surrounding context, not just the hunks.
2. Check for risks based on the review focus (or a general checklist if none supplied):
   - Unbounded loops, recursion without clear base case
   - New dependencies, especially ones with a history of CVEs
   - Error-handling changes that swallow or widen exception surfaces
   - Auth / authz surface (anything touching session, token, permission)
   - Data migration without a rollback path
   - Missing tests for logic that branches
   - Naming or API shape changes that break existing callers
3. Log progress:

```
mcp__claudepanion__`__NAME___append_log`({ id: "<entity-id>", message: "reviewed <path> (<N> hunks, <M> risks)" })
```

Keep notes per file: what changed, risk list, questions for the author.

## Step 5 — Synthesize the review

Produce a structured artifact matching `__PASCAL__Artifact` in `companions/__NAME__/types.ts` (the scaffolded shape has a single `summary` field; you may widen the type first if the review calls for more structure — in that case, write the updated type and the handler together):

```
mcp__claudepanion__`__NAME___save_artifact`({
  id: "<entity-id>",
  artifact: {
    summary: "<one-paragraph verdict — lead with overall recommendation>"
  }
})
```

If you widened the type, include the detailed fields as well (`filesReviewed`, `risks`, `questions`, `overall`).

## Step 6 — Complete

```
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "completed" })
```
