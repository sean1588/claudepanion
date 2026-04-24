---
name: __NAME__-companion
description: Use when the user pastes "/__NAME__-companion <entity-id>" — turns raw incident notes into a structured postmortem.
---

# /__NAME__-companion <entity-id>

Turn unstructured incident material — Slack threads, raw logs, pasted timelines, author recollection — into a structured postmortem following a canonical template.

> **CRITICAL — MCP tools ONLY:**
> - All state changes go through `mcp__claudepanion__`__NAME___*` tools.
> - NEVER curl `/api/entities/*`. NEVER edit `data/__NAME__/*.json`.
> - On any MCP error: `mcp__claudepanion__`__NAME___fail`` and stop.

## Step 1 — Load the entity

```
mcp__claudepanion__`__NAME___get`({ id: "<entity-id>" })
```

`entity.input.description` carries the raw incident material — often a long block of Slack-style timeline entries, error messages, and free-form notes. It may also include:
- A service name
- An incident date / start time
- A severity label

Don't demand perfectly-formed input. The whole point of this companion is to accept the mess and structure it.

## Step 2 — Mark running

```
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "running", statusMessage: "parsing timeline" })
```

## Step 3 — Parse the timeline

Walk the description and extract events with timestamps. Normalize timestamps to ISO-8601 where possible. If an event has no timestamp but clearly follows another, infer "~N minutes later."

Distinguish three event kinds:
- **Signal** — something the monitoring / paging / user report observed.
- **Action** — something a human or automated system did in response.
- **Observation** — something someone noticed that wasn't a signal (e.g., "CPU was pegged when I looked").

Log:

```
mcp__claudepanion__`__NAME___append_log`({ id: "<entity-id>", message: "extracted <N> timeline events" })
```

## Step 4 — Synthesize each section

Canonical structure:

```markdown
# Postmortem: <one-line title>

**Date:** <YYYY-MM-DD>
**Duration:** <start time>–<end time> (<N hours|minutes>)
**Severity:** <label>
**Services affected:** <comma-separated>

## Summary
<2–3 sentences. What happened, who noticed, how it was mitigated. No root cause here — that's later.>

## Impact
- <Users affected>
- <Customer-visible symptoms>
- <Downstream system effects>
- <Revenue or SLA consequences if known>

## Timeline
| Time (UTC) | Event |
|------------|-------|
| HH:MM:SS   | <signal/action/observation — concise past-tense>

## Root cause
<The actual technical cause. Be specific — file, function, config, SKU, whatever. If unknown, say "Unknown" with what's been ruled out.>

## Contributing factors
- <Second-order things that made this worse: monitoring gaps, recent changes, tight coupling, etc.>

## What went well
- <Honest list — credit people, credit process. Don't skip this section.>

## What went poorly
- <Honest list — gaps, delays, confusion. No names unless a person explicitly requests attribution.>

## Action items
| # | Action | Owner | Type | Due |
|---|--------|-------|------|-----|
| 1 | <action> | <person or team> | prevention | <date> |
| 2 | <action> | <person or team> | detection | <date> |
| 3 | <action> | <person or team> | mitigation | <date> |
```

Fill in only what the input + reasonable inference supports. When filling from inference, append `> _inferred_` to the bullet so the user can verify.

## Step 5 — Save artifact + complete

```
mcp__claudepanion__`__NAME___save_artifact`({
  id: "<entity-id>",
  artifact: {
    summary: "<the full markdown postmortem>"
  }
})

mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "completed" })
```
