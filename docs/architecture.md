# claudepanion Architecture

## Processes and transports

Express server on port 3000. Three public surfaces:
- `GET /c/<slug>` — server-rendered HTML per companion
- `GET/POST/DELETE /mcp` — MCP Streamable HTTP for Claude Code
- `GET /events` — SSE stream for browser live-updates

## MCP lifecycle

### The endpoint

`.mcp.json` at the repo root declares the MCP server. Claude Code reads this at session start and opens a connection at `/mcp`.

### Session lifecycle (Streamable HTTP, stateful)

Every `initialize` request creates a new session with a UUID returned in `Mcp-Session-Id` header. All subsequent requests echo that header. Disconnect cleans up. Stateless mode was considered but rejected because the SDK requires a fresh transport per request in stateless mode, which is awkward for a long-lived localhost process serving both the UI and MCP.

### Tool registration

At server start, `loadCompanions()` discovers every `companions/<slug>/` directory, loads each one's `tools/*.ts`, prefixes tool names with `<slug>_`, and registers them on the per-session `McpServer`. A fresh `McpServer` is created for each session and wired with the full tool set.

## Companion discovery

On boot, `src/companions.ts#loadCompanions(dir)`:
1. Lists directories under `companions/` alphabetically.
2. Reads each `manifest.json`, validates `slug` against `^[a-z][a-z0-9-]*$`, checks uniqueness.
3. Dynamically imports `tools/*.ts` files, prefixes tool names with `<slug>_`.
4. Imports `ui.ts` and captures `renderPage`.
5. Imports optional `routes.ts` and captures the default-exported Router.
6. Returns `Companion[]` which the server uses to mount UI routes, REST routes, and MCP tools.

New companions require a server restart to be picked up. In dev mode (`claudepanion dev`), `tsx watch` restarts automatically on file changes.

## Request lifecycle (polling pattern)

Most companions follow the polling pattern implemented by `src/helpers/requestStore.ts`:

1. User submits work via `POST /api/c/<slug>/requests` (handled by the helper's router).
2. Request written to `data/<slug>.json` with `status: pending`, `version: 1`.
3. Claude calls `<slug>_list` → `<slug>_claim(id, version)` (optimistic concurrency).
4. Claude calls `<slug>_log(id, msg)` as it works; each call broadcasts SSE to the UI.
5. Claude calls `<slug>_complete(id, { summary, files })` on success or `{ error }` on failure.
6. Helper persists the terminal state; tool handler broadcasts final update.

Version bumps on every mutation enable optimistic-concurrency claim races (two simultaneous claimers; second gets rejected cleanly).

## SSE

`/events` is a single stream. Companions broadcast scoped events via `ctx.broadcast('<slug>.<verb>', data)`. The platform fan-outs to every connected browser. Heartbeat every 25s keeps intermediaries from idle-timeout.

## Plugin registration

`claudepanion plugin install` edits `.claude/settings.local.json` in the current repo to enable the plugin and register a local directory marketplace pointing at the claudepanion clone. See the CLI source at `bin/claudepanion` for exact shape.
