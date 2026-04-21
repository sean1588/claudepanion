# Claude Manager

A localhost companion app for [Claude Code](https://claude.com/claude-code)
that lets you manage tasks and skills from a small web UI, and exposes both
through an MCP server so Claude can list, create, update, and complete them
on your behalf.

It is packaged as a Claude Code **plugin** — once installed, Claude
automatically discovers its MCP tools and a bundled skill that teaches
Claude how to use them.

---

## Quick start

```bash
# 1. install deps and link the `claude-manager` CLI globally
npm install
npm run install:global

# 2. from any git repo where you want to use it:
claude-manager plugin install   # registers the plugin in .claude/settings.local.json
claude-manager serve            # starts the server on http://localhost:3000
```

Open the UI at <http://localhost:3000>. Start a new Claude Code session in
the same repo and the `claude-manager` MCP tools + skill should load.

To undo:

```bash
claude-manager plugin uninstall
npm run uninstall:global
```

---

## Claude Code concepts, briefly

A few Claude Code terms are used throughout this project. If you already
know them, skip ahead.

### Plugin

A **plugin** is a directory Claude Code loads at session start. It can
contribute any combination of:

- an **MCP server** (via `.mcp.json`)
- **skills** (markdown files under `skills/`)
- slash commands, hooks, subagents, etc.

A plugin is made discoverable by listing it in a **marketplace** —
either the official one or a local `directory` marketplace pointing at
the plugin folder on disk. That's what `claude-manager plugin install`
wires up.

### Skill

A **skill** is a markdown file with YAML frontmatter that tells Claude
*when* and *how* to do something. The frontmatter has a `name` and a
`description`; the description is what Claude sees during skill
selection, so it should describe the trigger ("use when …"). The body
is the actual instructions.

Plugin skills live at `skills/<skill-name>/SKILL.md` inside the plugin.
This project bundles one: `skills/use-claude-manager-mcp/SKILL.md`,
which tells Claude to prefer the MCP tools for task tracking.

User-authored skills — the ones you create in the UI or via the
`skills_create` MCP tool — are separate runtime data and live under
`data/skills/<slug>.md`. They are not auto-loaded by Claude; they're
content the app manages for you to reference.

### MCP (Model Context Protocol)

MCP is the protocol Claude uses to talk to external tools and data
sources. A plugin declares an MCP server in `.mcp.json`; Claude Code
opens a connection at session start and calls `tools/list` to
discover what functions the server exposes. The user can then
invoke them (or Claude can, when appropriate).

Claude Code supports several transports. This project uses
**Streamable HTTP** — a single HTTP endpoint that handles JSON-RPC
POSTs and SSE streams on the same URL — because the server is a
long-running localhost process serving both the UI and MCP.

---

## Architecture

```
┌──────────────────────────┐        ┌──────────────────────────────┐
│  Claude Code session     │  MCP   │  Express server (port 3000)  │
│  (in any git repo)       │◄──────►│                              │
│                          │        │  ┌────────────────────────┐  │
│  • reads .mcp.json       │        │  │  /mcp   (Streamable    │  │
│  • loads skills/*/SKILL.md│       │  │          HTTP, MCP SDK)│  │
└──────────────────────────┘        │  └────────────────────────┘  │
                                    │  ┌────────────────────────┐  │
┌──────────────────────────┐        │  │  /api/tasks, /api/skills│ │
│  Browser UI              │◄──────►│  │  (REST, used by UI)    │  │
│  http://localhost:3000   │        │  └────────────────────────┘  │
│                          │        │  ┌────────────────────────┐  │
│  • server-rendered HTML  │        │  │  /events  (SSE, for    │  │
│  • live updates via SSE  │◄───────│  │            live badges)│  │
└──────────────────────────┘        │  └────────────────────────┘  │
                                    │                              │
                                    │       ┌──────────────┐       │
                                    │       │  store.ts    │       │
                                    │       │              │       │
                                    │       │ data/tasks.json      │
                                    │       │ data/skills/*.md     │
                                    │       └──────────────┘       │
                                    └──────────────────────────────┘
```

Both Claude (through MCP) and the UI (through REST) hit the same
`store.ts`. Writes broadcast over `/events` so the UI badge counts
update live without a poll.

### Project layout

```
claude-manager/
├── .mcp.json                    MCP server declaration for the plugin
├── .claude-plugin/
│   ├── plugin.json              Plugin metadata
│   └── marketplace.json         Local marketplace manifest
├── bin/claude-manager           CLI entry point (serve / plugin install)
├── skills/
│   └── use-claude-manager-mcp/
│       └── SKILL.md             Plugin-bundled skill
├── data/                        Runtime data (gitignored in practice)
│   ├── tasks.json
│   └── skills/*.md              User-authored skills
├── src/
│   ├── server.ts                Express app + REST + UI routes
│   ├── store.ts                 Read/write tasks & skills
│   ├── types.ts
│   ├── mcp/
│   │   ├── server.ts            createMcpServer + mountMcp
│   │   ├── types.ts             McpToolDefinition, helpers
│   │   └── tools/               One file per MCP tool
│   └── ui/                      Server-rendered HTML
```

---

## MCP setup in detail

### The endpoint

`.mcp.json` at the repo root is what Claude Code reads:

```json
{
  "mcpServers": {
    "claude-manager": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

`"type": "http"` means **Streamable HTTP** — the modern MCP transport
where one URL handles:

- `POST` — JSON-RPC requests; response is either JSON or SSE
- `GET`  — opens a server→client SSE stream for notifications
- `DELETE` — tears down the session

### Session lifecycle

The MCP SDK's `StreamableHTTPServerTransport` runs in **stateful**
mode here: every client that calls `initialize` gets a new session id
(returned in the `Mcp-Session-Id` response header). All subsequent
requests must echo that header back. When the client disconnects the
session is cleaned up.

Stateless mode (no session ids) exists, but the SDK requires a fresh
transport *per request* in that mode, which doesn't play well with a
single long-lived server. Stateful is simpler and matches what Claude
Code does anyway.

`src/mcp/server.ts` implements this with a `transports` Map keyed by
session id:

```
POST /mcp + isInitializeRequest(body)   → new transport + new McpServer
POST /mcp + Mcp-Session-Id header       → route to existing transport
GET  /mcp + Mcp-Session-Id header       → open SSE stream for session
DELETE /mcp + Mcp-Session-Id header     → close session
```

### Registering tools

Each MCP tool is a small module exporting an `McpToolDefinition`:

```ts
// src/mcp/tools/tasks-list.ts
import { getTasks } from '../../store.js';
import { McpToolDefinition, successResult } from '../types.js';

export const tasksListTool: McpToolDefinition<Record<string, never>> = {
  name: 'tasks_list',
  description: 'List all tasks.',
  schema: {},
  async handler() {
    return successResult({ tasks: await getTasks() });
  },
};
```

`src/mcp/tools/index.ts` collects all of them, and `createMcpServer`
registers each one with the MCP SDK:

```ts
for (const tool of mcpTools) {
  server.tool(tool.name, tool.description, tool.schema, async (params) =>
    tool.handler(params as Record<string, unknown>, context),
  );
}
```

`context` is a small injected object with a `broadcast` function —
after mutating data, a tool broadcasts over `/events` so the UI
refreshes live while Claude works.

### Available tools

| Tool | Purpose |
|------|---------|
| `tasks_list` | List all tasks |
| `tasks_get` | Get one task by id |
| `tasks_create` | Create a task |
| `tasks_update` | Patch title/description/status |
| `tasks_update_status` | Move between `todo` / `in_progress` / `done` |
| `tasks_delete` | Delete a task |
| `skills_list` | List user-authored skills |
| `skills_get` | Read one skill |
| `skills_create` | Create a skill (writes `data/skills/<slug>.md`) |
| `skills_update` | Edit a skill |
| `skills_delete` | Delete a skill |

Input schemas are defined with zod in each tool file.

### Testing the MCP endpoint manually

```bash
# 1. initialize — grab the session id from the response headers
curl -i -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{
    "protocolVersion":"2025-06-18","capabilities":{},
    "clientInfo":{"name":"curl","version":"0"}}}'

# 2. use the session id to list tools
SID=<copy from mcp-session-id header>
curl -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: $SID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3. call a tool
curl -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: $SID" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call",
       "params":{"name":"tasks_list","arguments":{}}}'
```

---

## How the plugin registration works

`claude-manager plugin install` edits `.claude/settings.local.json`
in the current git repo to add two entries:

```json
{
  "enabledPlugins": {
    "claude-manager@local": true
  },
  "extraKnownMarketplaces": {
    "local": {
      "source": { "source": "directory", "path": "/abs/path/to/claude-manager" }
    }
  }
}
```

Claude Code reads these on session start:

1. It finds the `local` marketplace and loads `.claude-plugin/marketplace.json`.
2. That marketplace lists `claude-manager` with `"source": "./"`, so Claude loads the plugin from the same directory.
3. From the plugin it reads `.claude-plugin/plugin.json`, `.mcp.json`, and `skills/*/SKILL.md`.
4. It connects to the MCP server on `localhost:3000/mcp` and loads the skill.

Next session, the tools are available as
`mcp__claude-manager__tasks_list` and so on.

---

## Development

```bash
npm run dev      # tsx watch mode
npm run check    # typecheck only
npm run build    # emit dist/
```

Data lives under `data/`. Delete the directory to reset.
