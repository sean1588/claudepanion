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

## Step 2 — Mark running

```
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "running", statusMessage: "starting" })
```

## Step 3 — Do the work

__DESCRIPTION__

### 3a — Call domain proxy tools for external system access

If this companion has domain proxy tools (defined in `companions/__NAME__/server/tools.ts`),
call them to access external systems. These are your primary data source.

```
mcp__claudepanion__`__NAME___<verb>`({ id: "<entity-id>", ... })
```

After each proxy tool call, log what you received:

```
mcp__claudepanion__`__NAME___append_log`({ id: "<entity-id>", message: "fetched 47 records from <source>" })
```

### 3b — Use Claude's built-in tools for local work (if needed)

Use Read, Grep, Bash, and Edit for local file or repository access.

Stream progress after each meaningful step:

```
mcp__claudepanion__`__NAME___append_log`({ id: "<entity-id>", message: "<what you just did>" })
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "running", statusMessage: "<current phase>" })
```

## Step 4 — Save the artifact

When the work produces a result, save it. The artifact shape is defined by `__PASCAL__Artifact` in `companions/__NAME__/types.ts`:

```
mcp__claudepanion__`__NAME___save_artifact`({
  id: "<entity-id>",
  artifact: { summary: "<one or two sentences describing the result>" }
})
```

## Step 5 — Complete

```
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "completed" })
```

## On error at any step

```
mcp__claudepanion__`__NAME___fail`({ id: "<entity-id>", errorMessage: "<short cause>", errorStack: "<optional stack>" })
```
