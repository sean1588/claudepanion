---
name: __NAME__-companion
description: Use when the user pastes "/__NAME__-companion <entity-id>" — critiques a design doc for ambiguities, missing constraints, and unstated assumptions.
---

# /__NAME__-companion <entity-id>

Read a design doc the user has pasted or pointed at, and produce a structured critique. Focus on ambiguities, unstated assumptions, missing edge cases — not prose polish.

> **CRITICAL — MCP tools ONLY:**
> - All state changes go through `mcp__claudepanion__`__NAME___*` tools.
> - NEVER curl `/api/entities/*`. NEVER edit `data/__NAME__/*.json`.
> - On any MCP error: `mcp__claudepanion__`__NAME___fail`` and stop.

## Step 1 — Load the entity

```
mcp__claudepanion__`__NAME___get`({ id: "<entity-id>" })
```

`entity.input.description` holds either:
- The full pasted doc markdown (most common — user pastes right into the form).
- A file path if the doc is on disk (e.g. `docs/design/new-auth.md`).
- A focus qualifier appended after the doc ("be harsh on the data-migration section").

If it's a file path, Read the file. If it's the pasted doc, use it verbatim. No mode requires external API access.

## Step 2 — Mark running

```
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "running", statusMessage: "reading doc" })
```

## Step 3 — Walk the checklist

Score the doc against these dimensions. Quote the doc where each finding applies — a critique without a quote is a vibe, not a review.

1. **Scope clarity** — can a reader say what's in and out of scope in one sentence?
2. **Success criteria** — are there measurable outcomes? ("p95 < 200ms" is measurable; "fast" is not.)
3. **Non-goals** — is anything the doc is *not* doing named explicitly?
4. **Assumptions** — what's taken as given? Are any assumptions load-bearing but unstated?
5. **Risks** — does the doc name what could go wrong? If yes, are mitigations concrete?
6. **Edge cases** — what happens at zero, at maximum, on failure, under concurrent load?
7. **Migration / rollback** — if this changes behavior, how does the system get from here to there? How does it roll back?
8. **Alternatives considered** — is there any sign the author weighed options, or does the doc present one path as if it's the only one?
9. **Contract shape** — for API / schema / interface proposals, is the exact shape written down (types, names, error codes)?
10. **Operational burden** — who pages when this breaks? What metrics go green/red?

Log per dimension as you finish:

```
mcp__claudepanion__`__NAME___append_log`({ id: "<entity-id>", message: "checked <dimension> — <N> findings" })
```

## Step 4 — Apply focus qualifier

If the description included a focus like "be harsh on data-migration," weight findings in that section heavier — more detail, more alternative suggestions, fewer softening qualifiers.

## Step 5 — Save artifact + complete

Output structure:

```markdown
## Design doc review: <title>

### Summary
<1–2 sentences — is this ready to implement as-is, does it need revision, or should it be rescoped?>

### Findings

For each finding:
- **<Dimension>** — <quote from doc>
  - Concern: <what's ambiguous or missing>
  - Suggestion: <concrete next step>

### Strengths
<1–2 bullets on what's done well, kept brief. Balance the tone.>
```

Save:

```
mcp__claudepanion__`__NAME___save_artifact`({
  id: "<entity-id>",
  artifact: {
    summary: "<the full markdown critique>"
  }
})

mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "completed" })
```
