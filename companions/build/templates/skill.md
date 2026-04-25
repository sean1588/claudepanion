---
name: __NAME__-companion
description: Use when the user pastes "/__NAME__-companion <entity-id>" — runs the __NAME__ companion against one of its pending entities.
---

# /__NAME__-companion <entity-id>

Execute one __NAME__ entity to completion.

> **CRITICAL — MCP tools ONLY:**
> - Use the MCP tools prefixed `mcp__claudepanion__` for ALL state changes (status, logs, artifact, failure).
> - NEVER curl the REST API at `/api/entities/*` to mutate state.
> - NEVER edit `data/__NAME__/<id>.json` directly.
> - If an MCP tool returns an error, call `mcp__claudepanion__`__NAME___fail`` and stop. Do NOT fall back to HTTP.
> - If `mcp__claudepanion__` tools are not available in your session, stop and tell the user to verify `claudepanion plugin install` and that the server is running, then start a new Claude Code session.

## Step 1 — Load the entity

```
mcp__claudepanion__`__NAME___get`({ id: "<entity-id>" })
```

If the call errors or the entity is missing, stop.

### Step 1.5 — Detect continuation

If `entity.artifact !== null`, this is a continuation — the user clicked "Continue" on a previously completed run. Read the prior artifact carefully before doing new work. Use updated `entity.input` fields as the user's redirection. Log:

```
mcp__claudepanion__`__NAME___append_log`({ id: "<entity-id>", message: "Continuing from prior run — reading previous artifact" })
```

Produce a complete, updated artifact when you save (not a diff).

## Step 2 — Preflight check

Verify the companion's required env vars are set:

```bash
curl -s http://localhost:3001/api/companions/__NAME__/preflight
```

If the response shows `missingRequired` non-empty:

```
mcp__claudepanion__`__NAME___fail`({ id: "<entity-id>", errorMessage: "[config] missing env vars: <list>" })
```

and stop.

## Step 3 — Mark running

```
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "running", statusMessage: "starting" })
```

## Step 4 — Do the work

__DESCRIPTION__

### 4a — Call domain proxy tools for external system access

If this companion has domain proxy tools (defined in `companions/__NAME__/server/tools.ts`), call them to access external systems. These are your primary data source.

```
mcp__claudepanion__`__NAME___<verb>`({ id: "<entity-id>", ... })
```

After each proxy tool call, log what you received:

```
mcp__claudepanion__`__NAME___append_log`({ id: "<entity-id>", message: "fetched 47 records from <source>" })
```

### 4b — Use Claude's built-in tools for local work (optional)

Use Read, Grep, Bash, and Edit for local file or repository access.

Stream progress after each meaningful step:

```
mcp__claudepanion__`__NAME___append_log`({ id: "<entity-id>", message: "<what you just did>" })
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "running", statusMessage: "<current phase>" })
```

### 4c — Write actions require user permission

If a proxy tool has `sideEffect: "write"` (changes state in an external system), you MUST ask the user before calling it:

1. Show the proposed write content in chat ("Here's the review I'd post to GitHub: …")
2. Ask: "Should I post this?"
3. Wait for confirmation
4. Only call the write tool if confirmed
5. If declined, save the artifact with `errors: ["user declined write action"]` and proceed to Step 5

Never call a write tool without explicit user permission.

## Step 5 — Save the artifact

The artifact shape is defined by `__PASCAL__Artifact` in `companions/__NAME__/types.ts`. It extends `BaseArtifact` so it may include `summary?: string` and `errors?: string[]`:

```
mcp__claudepanion__`__NAME___save_artifact`({
  id: "<entity-id>",
  artifact: {
    summary: "<one-line outcome>",
    errors: [<any [recoverable] errors logged during the run>],
    // ... your custom artifact fields
  }
})
```

## Step 6 — Complete

```
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "completed" })
```

## Error handling

When a proxy tool returns an error, branch on the prefix:

| Prefix | Action |
|---|---|
| `[config]` | Call `__NAME___fail` with the error message and stop |
| `[input]` | Call `__NAME___fail` with the error message and stop |
| `[transient]` | Log warn, retry the tool ONCE; if still failing, call `__NAME___fail` |
| `[recoverable]` | Log warn, continue; add the message to the artifact's `errors[]` field |
| (no prefix) | Treat as fatal: call `__NAME___fail` |

For example:

```
const result = mcp__claudepanion__`__NAME___fetch_thing`({...})
if (result.isError) {
  if (result.content[0].text.startsWith("[transient]")) {
    // log warn, retry once
  } else if (result.content[0].text.startsWith("[recoverable]")) {
    // log warn, add to artifact.errors, continue
  } else {
    mcp__claudepanion__`__NAME___fail`({ id, errorMessage: result.content[0].text })
    // stop
  }
}
```

## On unrecoverable error at any step

```
mcp__claudepanion__`__NAME___fail`({ id: "<entity-id>", errorMessage: "<short cause>", errorStack: "<optional stack>" })
```
