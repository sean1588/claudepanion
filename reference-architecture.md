# Reference Architecture

**Source:** `/home/sean/projects/oncall-investigator`
**Purpose:** Everything claudepanion should model itself on. This doc captures the exact mechanics — file by file, field by field — so future changes stay aligned.

> This doc exists because claudepanion's plugin story drifted. The CLI I shipped (`claudepanion plugin install`) only touches `.mcp.json`, which gets you MCP tools but **does not** register the plugin in Claude Code — so skills never load. The oncall-investigator reference gets all of this right. This doc is the authoritative ground truth for how every piece fits together.

---

## 0. Mental model in one paragraph

A Claude Code plugin is a directory on disk. That directory contains (a) a `.claude-plugin/plugin.json` manifest, (b) an `.mcp.json` declaring HTTP-endpoint MCP servers, and (c) a `skills/<name>/SKILL.md` for each slash command the plugin offers. Claude Code discovers a plugin directory only after the user *registers it as an enabled plugin from a known marketplace* in `.claude/settings.local.json`. A CLI command wraps that registration so the user doesn't have to edit JSON by hand. Once enabled, Claude Code auto-connects to the plugin's MCP server(s) and auto-loads its skills at every new session. The plugin's local server is what the `.mcp.json` points at — a normal Express process that also serves the UI and the REST API on the same port. That's the entire stack.

---

## 1. Repository layout (oncall-investigator)

```
oncall-investigator/
├─ bin/
│  └─ investigator                 # Node ESM CLI, no extension, shebang #!/usr/bin/env node
├─ .claude-plugin/
│  ├─ plugin.json                  # Plugin metadata (required by Claude Code)
│  └─ marketplace.json             # Declares a local "marketplace" containing this plugin
├─ .claude/
│  └─ settings.local.json          # Per-machine Claude Code config — gitignored in practice
├─ .mcp.json                       # MCP server declaration — read by Claude Code once plugin is enabled
├─ package.json                    # "bin" entry + install:global script
├─ skills/
│  └─ oncall-investigate/
│     └─ SKILL.md                  # Slash command playbook with YAML frontmatter
├─ server/
│  ├─ index.ts                     # Express bootstrap — API + MCP + static UI on ONE port
│  ├─ data-store.ts                # Per-entity JSON file storage
│  ├─ investigation-input.ts       # Input validation/normalization
│  ├─ routes/
│  │  ├─ investigations.ts         # REST: GET/POST/PUT /api/investigations
│  │  └─ aws.ts                    # REST: AWS proxy surfaces for UI
│  └─ mcp/
│     ├─ server.ts                 # MCP server factory + Express mount
│     ├─ types.ts                  # Tool interface + helpers
│     ├─ aws-handlers.ts           # AWS SDK wrappers called by tools
│     └─ tools/
│        ├─ index.ts               # Tool registry (array + map)
│        ├─ get-investigation.ts
│        ├─ query-logs.ts
│        └─ ... one file per tool
└─ client/
   ├─ vite.config.js               # Vite root IS the client/ dir
   ├─ index.html
   ├─ tsconfig.json
   ├─ src/
   │  ├─ main.tsx                  # ReactDOM.createRoot + BrowserRouter
   │  ├─ App.tsx                   # Sidebar + breadcrumb + Routes
   │  ├─ pages/                    # Route components
   │  ├─ components/               # Shared widgets
   │  └─ api.ts                    # fetch wrappers
   └─ dist/                        # Vite output, gitignored
```

**Key shape facts:**

- **No monorepo, no workspaces.** Single `package.json` at the root.
- **Server is TS, run by tsx.** No pre-compile step for the server. `bin/investigator serve` spawns `tsx server/index.ts`.
- **Client is built by vite.** Output goes to `client/dist/`. Express serves it statically.
- **One port.** Default 3456. React UI, REST API, and MCP endpoint all served from the same Express process.
- **skills live at `skills/<name>/SKILL.md`** — nested, with the literal filename `SKILL.md`. **Not** flat `skills/<name>.md`.

---

## 2. The three manifest files — what each one is for

This is the part claudepanion got wrong. Three separate files cooperate.

### 2a. `.claude-plugin/plugin.json`

Plugin *metadata*. Minimal, declarative. What Claude Code reads to know "this directory is a plugin called X."

```json
{
  "name": "oncall-investigator",
  "description": "...",
  "version": "0.1.0",
  "author": { "name": "Sean Holung" },
  "license": "UNLICENSED",
  "keywords": ["oncall", "cloudwatch", "investigation", "mcp", "dlq"]
}
```

**Fields that matter for wiring:**

- `name` — the plugin's identifier. Shows up in Claude Code's `/plugin` UI as `oncall-investigator@<marketplace>`.
- `version` — plugin version, separate from the app's server version. Changes here don't affect the MCP server directly.

**Fields plugin.json does NOT contain:**

- **No `mcpServers` entry.** Claude Code reads MCP server declarations from `.mcp.json` at the plugin root, not from `plugin.json`.
- **No `skills` entry.** Claude Code auto-discovers them from `skills/<name>/SKILL.md`.

This is important: plugin.json is the *passport*, not the *wiring diagram*. The wiring happens through filesystem conventions.

### 2b. `.claude-plugin/marketplace.json`

Declares a *marketplace* — a named bundle of one or more plugins. In a published ecosystem, a marketplace might host hundreds of plugins. Here, the marketplace is local and contains exactly one plugin: this repo.

```json
{
  "name": "local",
  "description": "Local marketplace for On-Call Investigator",
  "owner": { "name": "Sean" },
  "plugins": [
    {
      "name": "oncall-investigator",
      "description": "...",
      "version": "0.1.0",
      "source": "./",           ← relative to the marketplace root, this directory
      "author": { "name": "Sean Holung" }
    }
  ]
}
```

**Why it exists:** Claude Code's plugin system requires every plugin to come from *some* marketplace. For a self-contained repo, you declare a one-plugin marketplace pointing at the same directory. This is how local-directory distribution works.

### 2c. `.mcp.json` (at the plugin/repo root)

Declares the MCP server(s) the plugin provides. Read by Claude Code once the plugin is enabled.

```json
{
  "mcpServers": {
    "oncall-investigator": {
      "type": "http",
      "url": "http://localhost:3456/mcp"
    }
  }
}
```

**Notes:**

- `type: "http"` means Streamable HTTP transport. Claude Code opens a long-lived HTTP connection for MCP messages.
- `url` must match wherever your Express server is actually listening. Hard-coded here.
- Server name (`oncall-investigator`) is the MCP server identifier Claude Code uses internally.

### 2d. How they cooperate

When a user runs `investigator plugin install`:

1. The CLI updates `.claude/settings.local.json` (see §3) to register this directory as a known marketplace and enable the `oncall-investigator` plugin from it.
2. On the next Claude Code session start, Claude Code consults `settings.local.json`, sees the enabled plugin, walks to the marketplace path, reads `marketplace.json`, finds the plugin entry, and resolves it to the plugin directory (`./` relative to the marketplace root).
3. From that directory, Claude Code reads `plugin.json` for metadata, `.mcp.json` for MCP server registration, and `skills/*/SKILL.md` for slash commands.
4. Claude Code connects to the MCP server (in-session) and makes skills available as slash commands.

---

## 3. Per-machine activation — `.claude/settings.local.json`

The user's per-repo plugin config. **Not committed** (gitignored in most projects; oncall-investigator's repo contains a minimal version committed with `disabledMcpjsonServers` set — see §3b).

### 3a. What `investigator plugin install` writes

```json
{
  "enabledPlugins": {
    "oncall-investigator@local": true
  },
  "extraKnownMarketplaces": {
    "local": {
      "source": {
        "source": "directory",
        "path": "/absolute/path/to/oncall-investigator"
      }
    }
  }
}
```

**Two fields, both required:**

- `enabledPlugins["<plugin-name>@<marketplace-name>"] = true` — opts this plugin into this repo.
- `extraKnownMarketplaces["<marketplace-name>"] = { source: { source: "directory", path: <abs-path> } }` — tells Claude Code where to find the marketplace on disk.

The marketplace name (`local`) matches the `name` field in `marketplace.json`. The plugin name (`oncall-investigator`) matches `plugin.json`'s `name`.

### 3b. The `disabledMcpjsonServers` quirk

If you commit a `.mcp.json` at the repo root, Claude Code picks it up from the cwd at every session start — not just through the plugin. That causes a double-registration: once via the plugin system, once via the cwd `.mcp.json`. To prevent that, oncall-investigator ships a committed `settings.local.json` pre-declaring the cwd pickup as disabled:

```json
{
  "disabledMcpjsonServers": ["oncall-investigator"]
}
```

This is a small concession to the fact that the repo ships `.mcp.json` (useful for users who don't install as a plugin and just want the MCP server) while also being installable as a plugin.

**When the user runs `investigator plugin install`, the CLI merges `enabledPlugins` and `extraKnownMarketplaces` into this existing file, keeping `disabledMcpjsonServers` intact.**

### 3c. The install command in detail

From `bin/investigator`:

```js
function pluginInstall() {
  const gitRoot = findGitRoot();                           // walk up from cwd looking for .git
  if (!gitRoot) die("Error: not inside a git repository");

  const settingsPath = path.join(gitRoot, '.claude', 'settings.local.json');
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  }

  if (!settings.enabledPlugins) settings.enabledPlugins = {};
  settings.enabledPlugins['oncall-investigator@local'] = true;

  if (!settings.extraKnownMarketplaces) settings.extraKnownMarketplaces = {};
  settings.extraKnownMarketplaces.local = {
    source: { source: 'directory', path: PLUGIN_DIR },     // absolute path to this repo
  };

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  console.log('✓  Plugin installed in Claude Code');
  console.log('   Start a new Claude Code session for the plugin to load.');
}
```

**Three critical things this does:**

1. **Finds the target repo's `.claude/` directory** — by walking up from the cwd looking for `.git`. The install is *per-repo*, not global.
2. **Points at the plugin's own directory** — `PLUGIN_DIR = path.resolve(__dirname, '..')` — so the marketplace source is absolute, stable across the user's cwd.
3. **Merges non-destructively** — reads existing settings, adds these two keys, preserves the rest. Plays nicely with other plugins the user may have installed in the same repo.

### 3d. The uninstall command

Symmetric. Removes both entries:

```js
delete settings.enabledPlugins['oncall-investigator@local'];
delete settings.extraKnownMarketplaces.local;
```

Leaves `disabledMcpjsonServers` alone.

---

## 4. Server architecture — one process, one port, three surfaces

### 4a. Entry point (`server/index.ts`)

```ts
const PORT = process.env.PORT || 3456;
const DATA_DIR = path.join(__dirname, 'data');

const store = createDataStore(DATA_DIR);
const app = express();
app.use(express.json());

app.use('/api/investigations', createInvestigationRoutes(store));
app.use('/api', createAwsRoutes());

mountMcp(app, store);

const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/mcp')) {
    res.sendFile(path.join(clientDist, 'index.html'));
  } else {
    next();
  }
});
```

**Surfaces in order:**

1. REST API at `/api/investigations/*` — entity CRUD.
2. REST API at `/api/aws/*` — AWS proxy surfaces used by the UI (list profiles, alarms, log groups, DLQ queues, etc.).
3. MCP endpoint at `/mcp` — mounted via `mountMcp()`.
4. Static React bundle from `client/dist/` — catch-all for anything not starting with `/api` or `/mcp`.

**One port serves all four.** This is load-bearing: the `.mcp.json` URL must match where the UI is, because users connect Claude Code to the same machine that hosts the browser tab.

### 4b. MCP mount — Streamable HTTP with per-session transports

From `server/mcp/server.ts`:

```ts
export function mountMcp(app: Express, store: DataStore): void {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.all('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (req.method === 'POST') {
      const body = await readBody(req);
      const isInit = body?.method === 'initialize' || (Array.isArray(body) && body.some(m => m.method === 'initialize'));

      if (isInit) {
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
        const server = createMcpServer(store);
        await server.connect(transport);
        transport.onclose = () => { if (transport.sessionId) transports.delete(transport.sessionId); };
        await transport.handleRequest(req, res, body);
        if (transport.sessionId) transports.set(transport.sessionId, transport);
        return;
      }

      // Subsequent messages: look up session by Mcp-Session-Id header
      if (!sessionId || !transports.has(sessionId)) {
        return res.status(400).json({ error: 'Invalid or missing session ID' });
      }
      await transports.get(sessionId)!.handleRequest(req, res, body);
      return;
    }

    // GET and DELETE are also routed by session-id
    ...
  });
}
```

**Key mechanics:**

- **One transport per Claude Code session.** A fresh `initialize` POST creates a new transport; subsequent requests on the same session echo the session ID in the `Mcp-Session-Id` header.
- **`createMcpServer(store)` is called per session.** Each session gets its own `McpServer` instance with its own `activeInvestigationId` state. Sessions are isolated.
- **Session ID is a UUID** generated server-side and returned to the client on initialize.
- **`transport.onclose` cleans up.** When a client disconnects, the transport's entry is removed from the map.

This is identical to what claudepanion does in `src/server/mcp.ts` — good, one thing we got right.

### 4c. Tool registration pattern

Each MCP tool is a typed object with four fields (`server/mcp/types.ts`):

```ts
export interface McpToolDefinition<TParams> {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  handler: (params: TParams, context: McpToolContext) => Promise<McpResult>;
}
```

And the context object that every handler receives:

```ts
export interface McpToolContext {
  store: DataStore;
  awsHandlers: AwsHandlers;
  setActiveInvestigationId: (id: string | null) => void;
  logToActive: (message: string) => void;
}
```

**Example tool (`server/mcp/tools/get-investigation.ts`):**

```ts
export const getInvestigationTool: McpToolDefinition<{ id: string }> = {
  name: 'get_investigation',
  description: 'Get investigation details by ID — returns profile, log groups, alarm, and context',
  schema: {
    id: z.string().describe('Investigation ID (e.g. inv-abc123)'),
  },
  async handler({ id }, context) {
    context.setActiveInvestigationId(id);
    context.store.appendLog(id, `Reading investigation details for ${id}`);
    const inv = context.store.get(id);
    if (!inv) return errorResult(`Investigation ${id} not found`);
    return successResult(inv);
  },
};
```

**Pattern highlights:**

- Tools are plain typed objects, not classes.
- Zod schemas describe parameters with `.describe(...)` strings that become MCP parameter documentation.
- Handlers return `McpResult` — either `{ content: [{ type: 'text', text: string }] }` on success or `{ isError: true, content: [...] }` on failure.
- The context object is *mutable per session*: `setActiveInvestigationId` and `logToActive` track which entity the current session is working on. This is how tool calls automatically log to the correct investigation's timeline.

All tools are collected in `server/mcp/tools/index.ts`:

```ts
export const mcpTools: AnyMcpToolDefinition[] = [
  getInvestigationTool,
  listInvestigationsTool,
  updateStatusTool,
  saveReportTool,
  queryLogsTool,
  getLogGroupsTool,
  getAlarmsTool,
];
```

Then registered in bulk inside `createMcpServer`:

```ts
for (const tool of mcpTools) {
  server.tool(tool.name, tool.description, tool.schema, async (params) =>
    tool.handler(params as Record<string, unknown>, context)
  );
}
```

---

## 5. Data layer — per-entity JSON files

`server/data-store.ts` uses plain `fs.writeFileSync` with JSON stringified content. One file per entity at `server/data/inv-<6hex>.json`.

**No atomic-rename dance** — this differs from what I wrote in claudepanion (which uses write-temp-then-rename). oncall-investigator's writes are direct. Given localhost single-user, this is fine in practice; concurrent writes on one entity from two Claude sessions are rare.

**The store interface is narrow and entity-centric:**

```ts
interface DataStore {
  create(input): Investigation;
  get(id): Investigation | null;
  list(status?): Investigation[];
  updateStatus(id, status, message?): Investigation | null;
  saveReport(id, report): Investigation | null;
  appendLog(id, message): Investigation | null;
  continueInvestigation(id, updatedInput?): Investigation | null;
  remove(id): boolean;
}
```

IDs are generated via `crypto.randomBytes(3).toString('hex')` → 6-hex-char suffix (`inv-ab12cd`).

---

## 6. REST API — what the UI talks to

From `server/routes/investigations.ts`:

```
GET    /api/investigations              → list all (?status=pending filter)
GET    /api/investigations/:id          → one entity
POST   /api/investigations              → create (body: form input)
PUT    /api/investigations/:id/status   → update status
GET    /api/investigations/:id/logs     → fetch logs since an index (for UI polling)
POST   /api/investigations/:id/continue → reopen as pending with optional new input
PUT    /api/investigations/:id/report   → save completed markdown report
DELETE /api/investigations/:id          → remove
```

**The UI calls REST. Claude calls MCP.** Both hit the same `DataStore`. REST is the read-mostly interface for the browser; MCP is the agent's write-mostly interface.

The `POST /continue` pattern — reopening a completed investigation as pending while preserving the prior report — is exactly the continuation flow claudepanion also implements. Match.

---

## 7. UI — React + Vite from a subdirectory

### 7a. Vite config (`client/vite.config.js`)

```js
export default defineConfig({
  plugins: [react()],
  root: '.',
  build: { outDir: 'dist' },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3456',
      '/mcp': 'http://localhost:3456',
    },
  },
});
```

**Notes:**

- Vite root is the `client/` directory, not the repo root. `index.html` lives beside the config.
- Dev server runs on 5173 and proxies `/api` + `/mcp` to the Express server on 3456.
- Prod build outputs to `client/dist/`, which the Express server serves statically.

### 7b. App shell

`App.tsx` is small and pragmatic. Sidebar with nav links (Investigations / New / etc.), main content area, breadcrumb, and routes. Not a separate CompanionRoute wrapper — straight `<Routes><Route path="/investigation/:id" ... /></Routes>`. No MCP tools for navigation. Plain REST.

The sidebar links are hard-coded for this app — there's no pluggable companion list like claudepanion. That's because oncall-investigator *is* one companion. It hasn't been generalized into a host.

### 7c. api.ts

Thin fetch wrappers. Handles `/api/investigations`, `/api/investigations/:id`, etc. No magic — just JSON over HTTP.

---

## 8. Skills — slash command playbooks

### 8a. File location: `skills/<name>/SKILL.md`

**Nested convention, literal filename `SKILL.md`.** This is the shape Claude Code's plugin loader expects. Our claudepanion put skills at `skills/<name>.md` (flat). Wrong shape.

### 8b. Frontmatter

```yaml
---
name: oncall-investigate
description: Use when investigating production alerts, PagerDuty incidents, DLQ messages, error spikes, or service failures — guides systematic CloudWatch log analysis, root cause tracing, code correlation, and incident report generation
argument-hint: <alert-description>
---
```

**Three fields:**

- `name` — becomes the slash command. `name: oncall-investigate` → `/oncall-investigate` in Claude Code.
- `description` — longform trigger string. Claude's router reads this to decide when the skill fits.
- `argument-hint` — placeholder shown in the UI when the user types the slash command.

### 8c. Body

Markdown playbook. Uses `$ARGUMENTS` as a placeholder for whatever the user typed after the slash command name:

```markdown
# On-Call Investigation

Investigate: **$ARGUMENTS**

## Mode Detection

Determine which mode to use based on the argument:

- **MCP mode** — argument matches `inv-XXX` (an investigation ID). Call `get_investigation({ id: "inv-XXX" })` ...
- **Standalone mode** — argument is free-text. Proceed to Step 1.
```

**The body is load-bearing instruction for Claude.** Everything that happens during a run is driven by what's written here: which MCP tools to call, in which order, what to do with the results, when to save the report. The skill is the program.

The long body (235+ lines) is a detailed operational playbook with tables, examples, and guardrails ("**CRITICAL: ALL AWS access MUST go through MCP proxy tools. NEVER use `aws` CLI commands.**"). This is intentional — reliability of agentic runs comes from the skill's precision, not from the infrastructure.

---

## 9. End-to-end flow — one complete invocation

Tracing a single run through the stack:

1. **User opens http://localhost:3456** in the browser.
2. Express serves `client/dist/index.html`, which boots the React SPA.
3. User fills the "On-Call Investigation" form, clicks **Create Investigation**.
4. SPA `POST /api/investigations` with the form input.
5. Express handler: `createInvestigationRoutes(store)` → `store.create(input)` → writes `server/data/inv-abc123.json` with `status: "pending"`, returns the Investigation object.
6. SPA redirects to `/investigation/inv-abc123`, displays the detail page with a copyable slash command `/oncall-investigate inv-abc123`.
7. **User copies the command and pastes it into Claude Code** — running inside any repo that has the plugin installed (i.e., has `enabledPlugins["oncall-investigator@local"] = true` in its `.claude/settings.local.json`).
8. Claude Code sees the slash command, matches it against the plugin's skill `name`, loads `skills/oncall-investigate/SKILL.md`.
9. Claude follows the skill body: first tool call is `get_investigation({ id: "inv-abc123" })`.
10. That MCP call:
    - SPA is already watching this entity's logs via `GET /api/investigations/:id/logs?since=N` polled every 2s.
    - Claude's MCP client opens a Streamable HTTP transport against `http://localhost:3456/mcp`.
    - First POST carries `method: "initialize"`. `mountMcp` creates a fresh `McpServer` + transport, returns session ID in response headers.
    - Claude's subsequent POST carries `Mcp-Session-Id: <uuid>` and `method: "tools/call"` with `get_investigation` + args.
    - `getInvestigationTool.handler` runs:
      - `setActiveInvestigationId("inv-abc123")` — binds the session to this entity.
      - `store.appendLog("inv-abc123", "Reading investigation details for inv-abc123")` — writes to the entity's JSON file.
      - Returns the investigation object serialized as MCP text content.
11. SPA's 2s poll picks up the new log line, renders it in the Logs tab.
12. Claude continues through the skill: calls `update_status`, then `query_logs`, then... each tool call appends a log line, each log line appears in the UI within 2s.
13. Finally Claude calls `save_report({ id, report: markdown })`. The store writes the report, flips status to `completed`, bumps `updatedAt`.
14. SPA polls `/api/investigations/:id` and sees `status: "completed"`. Swaps from "Logs" tab to "Report" tab, renders the markdown via `react-markdown`.
15. User reads the report, optionally clicks **Continue Investigating**, which `POST /api/investigations/:id/continue` — flipping the entity back to pending with the prior report preserved. A new slash command appears. Goto step 7.

**What makes this work:**

- The REST API is the UI's read path (polling).
- MCP is the agent's write path (tool calls).
- Both touch the same per-entity JSON file.
- The skill is the program Claude executes.
- One Express process, one port.

---

## 10. What claudepanion got wrong

Side-by-side map:

| Concern | oncall-investigator (correct) | claudepanion (as shipped) |
|---|---|---|
| CLI `plugin install` | Edits `.claude/settings.local.json` — enables plugin from a directory-source marketplace | Edits `.mcp.json` (WRONG — this only connects MCP tools, doesn't load skills) |
| Skill location | `skills/<name>/SKILL.md` (nested, literal `SKILL.md`) | `skills/<name>-companion.md` (flat — Claude Code does not discover these) |
| `.claude-plugin/plugin.json` | Present, minimal metadata | Present, minimal metadata ✓ |
| `.claude-plugin/marketplace.json` | Present, declares local marketplace | Present ✓ |
| `.mcp.json` | Present at root; pre-disabled in committed `.claude/settings.local.json` to avoid double-registration with plugin | Present at root; committed `.claude/settings.local.json` does not exist, so no disable — would cause duplicate if the plugin were correctly installed |
| CLI uninstall | Removes `enabledPlugins[...]` + `extraKnownMarketplaces[...]` from `.claude/settings.local.json` | Removes `.mcp.json` entry only (wrong file) |
| Server entry | `tsx server/index.ts` (no pre-build needed) | `node dist/src/server/index.js` (requires pre-build) |
| Vite root | `client/` subdirectory | Repo root |

**The cascading effect of the wrong `plugin install`:**

- MCP tools work, because the cwd `.mcp.json` is picked up automatically by Claude Code. That's why users see `build_get`, `build_update_status`, etc.
- Skills never load, because nothing ever registers the plugin in `.claude/settings.local.json`. Claude Code has no idea there's a skill.
- The user sees the symptom: "MCP tools are there, but `/build-companion` is not recognized."

---

## 11. Migration status — DONE

The migration described in this section was executed. Current state of claudepanion:

- ✅ **Skill moved** to `skills/build-companion/SKILL.md` (nested, literal `SKILL.md`). Verified: the file exists at the correct path.
- ✅ **CLI rewritten** in `bin/cli.js`. `plugin install` now edits `<repo>/.claude/settings.local.json` with three fields: `enabledPlugins["claudepanion@local"] = true`, `extraKnownMarketplaces.local = { source: { source: "directory", path: pkgRoot } }`, and `disabledMcpjsonServers` including `"claudepanion"` to suppress cwd-`.mcp.json` double-registration. Idempotent — re-install is safe. Uninstall removes all three in a matching pattern.
- ✅ **`.claude/settings.local.json` gitignored** to keep per-machine state (absolute paths, permission grants) out of the repo.
- ✅ **Docs updated** — README quickstart explains the real install semantics, troubleshooting has a dedicated entry for `/build-companion` not loading, and the Build pending-state note in the UI tells users to plugin-install + restart Claude Code.
- ✅ **Gates green** — lint, typecheck, 95 tests, full build all pass.

### Verification protocol (run on every future change to the plugin story)

1. `rm -f <target-repo>/.claude/settings.local.json` to simulate a clean machine.
2. `cd <target-repo> && claudepanion plugin install` — check that `.claude/settings.local.json` now contains the three fields above with an absolute path pointing at the claudepanion checkout.
3. `claudepanion serve` in another terminal.
4. Start a fresh Claude Code session in `<target-repo>`.
5. `/plugin` in Claude Code — `claudepanion@local` should be listed as installed.
6. `/build-companion` — should autocomplete with an argument hint. Typing a valid Build entity ID and hitting enter should invoke the skill body.

---

## 12. Things claudepanion does differently on purpose (don't migrate these)

Not everything from oncall-investigator should port over. These are intentional divergences:

- **Multiple companions.** oncall-investigator is one entity kind. Claudepanion has the Build companion plus a pluggable registry. The registry concept (`companions/index.ts`, `companions/<name>/`) stays.
- **Generic MCP tools per companion.** Claudepanion auto-registers `<name>_get`/`_list`/etc. per entity companion. oncall-investigator's tools are hand-written per-concern. For claudepanion's generalized companion framework, the auto-registration is correct.
- **Tool-kind companions.** No analog in oncall-investigator. Claudepanion's `kind: "tool"` path with `defineTool`-annotated handlers is novel and stays.
- **Watcher + soft re-mount.** oncall-investigator doesn't need this because the whole repo is one app; claudepanion needs it to add/iterate companions without restart.

The migration in §11 is strictly about plugin registration and skill filesystem layout. The framework-level architecture (registry, watcher, generic tools, two kinds) is claudepanion's own and correct.

---

## 13. Quick-reference summary card

| Question | Answer |
|---|---|
| Where does `/plugin install` really register? | `.claude/settings.local.json` — NOT `.mcp.json` |
| What two keys does it write? | `enabledPlugins["<plugin>@<marketplace>"] = true` + `extraKnownMarketplaces["<marketplace>"] = { source: { source: "directory", path: <abs> } }` |
| Where does Claude Code find the MCP server? | In the enabled plugin's `.mcp.json` at its root |
| Where does Claude Code find skills? | In the enabled plugin's `skills/<name>/SKILL.md` (nested, literal filename) |
| Why commit `.mcp.json` at the repo root if it's redundant? | Dev convenience — someone can just use MCP without installing the plugin. Disable via `disabledMcpjsonServers` when the plugin is installed. |
| What's the difference between the plugin CLI and the serve CLI? | `plugin install` writes config; `serve` runs the HTTP server the plugin's MCP entry points at. Separate concerns. |
| How does the plugin discover skills? Filesystem or manifest? | Filesystem. `plugin.json` has no skills list. Claude Code scans `<plugin>/skills/*/SKILL.md` on enable. |
| Why `<name>/SKILL.md` instead of `<name>.md`? | Claude Code's plugin loader convention. Flat won't be discovered. |
| What's the MCP wire protocol? | Streamable HTTP at `<baseUrl>/mcp`, session-per-initialize, `Mcp-Session-Id` header on every subsequent request. |
| Can one repo have multiple plugins installed? | Yes — `enabledPlugins` is a map. Each gets its own `@<marketplace>` suffix. |
| Is `.claude/settings.local.json` per-user or per-repo? | Per-repo. Lives next to the `.git/` dir. Gitignored by convention so it doesn't leak machine paths. |
