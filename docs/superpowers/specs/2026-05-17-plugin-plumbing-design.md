# Plugin Plumbing — Make claudepanion Work in Any Directory / For npm-install Users

**Status:** Approved design (2026-05-17). Next step: implementation plan via `superpowers:writing-plans`.

**Branch:** `fix/plugin-plumbing` (dedicated PR off `main`, after PR #24 / facelift merged as `48c2ba9`).

---

## Goal

A user who runs `npm install -g claudepanion` (no repo clone), then `claudepanion init` → `claudepanion serve` → `claudepanion plugin install`, can open Claude Code in **any working directory** and have both the companion slash commands **and** the MCP connection work. Today they only work when Claude Code's cwd is inside the framework checkout.

## Root Cause (confirmed)

- The `claudepanion` MCP server is declared **only** in the framework repo's project-scoped `./.mcp.json`. Claude Code loads a project `.mcp.json` only when cwd is inside that repo, so the MCP connection is unavailable everywhere else.
- `claudepanion init` lays down **no plugin plumbing**: `~/.claudepanion/` has neither `.claude-plugin/` (the marketplace/plugin manifest) nor a plugin-root `.mcp.json`. The `init.ts` SYMLINKS table covers only `companions/build`, `skills/build-companion`, `node_modules/claudepanion-host`.
- The current machine's `~/.claudepanion/.claude-plugin/` exists only because it was hand-created during a prior debugging session; a fresh npm-install user has nothing.

## Authoritative Claude Code Behavior (docs + cited issues)

These facts (from official docs and cited CC GitHub issues) constrain the design and **supersede** the earlier idea of "reconcile `known_marketplaces.json`":

1. A Claude Code plugin can bundle an MCP server via a **plugin-root `.mcp.json`** (same shape as a project `.mcp.json`). When the plugin is genuinely *installed*, that server connects regardless of cwd. `type: "http"` and `"streamable-http"` are accepted aliases.
2. `settings.json` `extraKnownMarketplaces` + `enabledPlugins` **alone is not sufficient** for non-interactive activation — CC bug [#32606](https://github.com/anthropics/claude-code/issues/32606) (auto-install prompt never fires; `installed_plugins.json` never updated → skills/commands don't load). Related: [#17832](https://github.com/anthropics/claude-code/issues/17832).
3. **Never hand-write** `~/.claude/plugins/known_marketplaces.json` (CC owns it; rewrites it one-way from `settings.json` at startup — hand-edits are overwritten) **or `installed_plugins.json`** (internal, undocumented, unsupported).
4. The supported non-interactive activation mechanism is the **`claude` CLI**: `claude plugin marketplace add <dir>` + `claude plugin install <name>@<marketplace>`. A marketplace path change is reconciled with `claude plugin marketplace update <name>` — **not** `marketplace remove` + `add`, which uninstalls plugins.
5. Plugin-provided `.mcp.json` loads only once the plugin is genuinely **installed** (not merely `enabledPlugins: true`). Therefore plugin activation is the single linchpin for **both** slash commands and MCP.

## Architecture (Approach B — dedicated modules)

Two new focused modules; `init`/`serve`/`plugin install` become thin callers. The init↔serve port agreement is structurally guaranteed by a single shared writer; the `claude` shell-out is isolated in one unit.

### `src/server/mcp-config.ts`

```ts
export function writeMcpConfig(home: string, port: number): { written: boolean; path: string };
```

- Computes the canonical `~/.claudepanion/.mcp.json` content for `port`, reads any existing file, writes **only if different** (`written` reflects whether a write happened). Create-or-update; never throws on absence.
- Single source of truth for the `.mcp.json` shape. Lives under `src/server/` because `boot.ts` is its hot-path caller and it expresses the server's MCP contract; `init.ts` imports it too.

### `src/cli/claude-plugin.ts`

```ts
export function ensureClaudePluginManifest(home: string, version: string): { path: string };

export type ActivateResult =
  | { activated: true; ranCommands: string[] }
  | { activated: false; reason: "claude-not-found" | "command-failed"; commands: string[]; detail?: string };

export function activatePlugin(opts: {
  home: string;
  spawn?: typeof import("node:child_process").spawn; // injectable for tests
  log?: (line: string) => void;
}): Promise<ActivateResult>;
```

- `ensureClaudePluginManifest` generates `~/.claudepanion/.claude-plugin/{plugin.json,marketplace.json}` idempotently. If `.claude-plugin` exists as a **symlink** (a prior approach / hand-fix), it is unlinked and replaced with a real directory before writing. Existing files are overwritten in place.
- `activatePlugin` runs the `claude` CLI shell-out. Never throws on `claude` absence — returns a structured result; the caller decides messaging.

### Thin callers

- **`src/cli/init.ts` (`runInit`)** — after the existing symlink/regenerate/tsc steps, calls `ensureClaudePluginManifest(home, version)` and `writeMcpConfig(home, 3001)`. Both added to `filesCreated`. `version` is read from the framework `package.json` (see Version Reconciliation). Generation runs *after* the existing "refuse to clobber non-claudepanion content" validate gate, preserving that protection.
- **`src/server/boot.ts`** — calls `writeMcpConfig(home, effectivePort)` exactly once before `app.listen`, so `.mcp.json` always matches the actually-bound port. `effectivePort` is the value `boot.ts` already computes (`opts.port ?? Number(process.env.PORT ?? 3001)`).
- **`src/cli/plugin-install.ts` (`runPluginInstall`)** — keeps its current `settings.json` writes unchanged, then calls `activatePlugin(...)`, then the `/mcp` self-report.

## Generated Artifacts

`~/.claudepanion/.claude-plugin/plugin.json`:

```json
{
  "name": "claudepanion",
  "description": "Localhost companion host for Claude Code — build small web apps whose backend is Claude Code over MCP.",
  "version": "<framework package.json version>",
  "author": { "name": "claudepanion" },
  "license": "Apache-2.0",
  "keywords": ["mcp", "claude", "companion", "reference-architecture"]
}
```

`~/.claudepanion/.claude-plugin/marketplace.json`:

```json
{
  "name": "local",
  "description": "Local marketplace for claudepanion",
  "owner": { "name": "claudepanion" },
  "plugins": [
    {
      "name": "claudepanion",
      "description": "Localhost companion host for Claude Code — build small web apps whose backend is Claude Code over MCP.",
      "version": "<framework package.json version>",
      "source": "./",
      "author": { "name": "claudepanion" }
    }
  ]
}
```

`source: "./"` means the plugin root is `~/.claudepanion` — unambiguous because this is a real file, not a symlink (the reason `.claude-plugin/` is generated, not symlinked). The plugin's skills/companions are already present there via the existing `init` symlinks.

`~/.claudepanion/.mcp.json`:

```json
{
  "mcpServers": {
    "claudepanion": { "type": "http", "url": "http://localhost:<port>/mcp" }
  }
}
```

A concrete port, not `${...}` interpolation — Claude Code's environment at session start has no `PORT`, which is exactly why `init` writes `3001` and `serve` corrects it.

Neither generated file is added to `~/.claudepanion/.gitignore`; they are durable config and the home may not be a git repo.

## Version Reconciliation

Framework `package.json` is `0.2.0` but the framework `.claude-plugin/plugin.json` is `0.3.0`. Single source of truth = `package.json`; the generated manifests derive their version from it, so no hardcoded version remains to drift. Reconciling all sources is in-scope because a generated manifest is incoherent without a correct authoritative version.

> **Superseded for first publish (2026-05-17):** rather than `0.3.0`, all version sources (`package.json`, framework `.claude-plugin/{plugin,marketplace}.json`) are set to **`0.0.1`** — nothing has been published to npm yet, so the first public release starts at `0.0.1`. The single-source-of-truth principle is unchanged; only the chosen number differs.

## Data Flow (end-to-end, npm-install user)

1. `npm i -g claudepanion` → `claudepanion init`: home dirs + symlinks (as today) **+ `.claude-plugin/{plugin.json,marketplace.json}` generated + `.mcp.json` written at default `:3001`**.
2. `claudepanion serve`: boots, binds effective port → **`writeMcpConfig(home, effectivePort)` rewrites `.mcp.json` iff the port differs** → server listening.
3. `claudepanion plugin install`: writes `settings.json` (unchanged) → **`activatePlugin`: `claude plugin marketplace add ~/.claudepanion` (or `marketplace update local` if already known) + `claude plugin install claudepanion@local`** → `/mcp` self-report → prints next-step + restart note.
4. User opens Claude Code in **any directory** → plugin installed/active → skills + slash commands load → plugin-provided `.mcp.json` connects the `claudepanion` MCP server globally.

## Activation Flow (`runPluginInstall`)

1. **`settings.json` (unchanged):** `enabledPlugins["claudepanion@local"]=true`, `extraKnownMarketplaces.local={source:{source:"directory",path:home}}`, `additionalDirectories` includes `home`. Idempotent. If `local` previously pointed elsewhere (old framework-checkout setup), this write updates the path.
2. **`activatePlugin`:**
   - Detect `claude` on PATH (`claude --version`). Absent → `{ activated:false, reason:"claude-not-found", commands:[…] }`; no throw.
   - **Marketplace (idempotent, path-change-safe, never remove):** `claude plugin marketplace add <home>`. If it reports already-known, treat as success **and** run `claude plugin marketplace update local` to refresh from the (possibly changed) path. Never `marketplace remove` (uninstalls plugins).
   - **Install:** `claude plugin install claudepanion@local`. Already-installed → success.
   - Returns the structured `ActivateResult`.
3. **`/mcp` self-report:** parse the port from `~/.claudepanion/.mcp.json` (serve's source of truth), then `GET http://localhost:<port>/api/health` for liveness and `GET http://localhost:<port>/api/mcp/status` for the richer MCP-up signal. Print a concise ✓/✗ checklist: settings written · `.claude-plugin/` + `.mcp.json` present · `claude` activation result · server reachable at `<port>` · **next step: "Restart your Claude Code session, then run `/<name>-companion <id>`."**
4. **Fallback & exit code:** if `claude` is absent or a command fails, print the exact manual commands (`claude plugin marketplace add ~/.claudepanion`, `claude plugin install claudepanion@local`, plus the in-session `/plugin` equivalents) + the restart note. `plugin install` **exits 0 even when degraded** (prints a prominent `ACTION REQUIRED` block); only true hard errors (settings.json unwritable, home missing) exit non-zero, keeping it script-composable. Re-running is always safe.

## Error Handling / Edge Cases

- `.claude-plugin` exists as a symlink → unlink, create real dir, write files. Existing files → overwrite in place (idempotent regenerate).
- Generation runs after `runInit`'s "refuse to clobber non-claudepanion content" validate gate — protection preserved.
- `serve` with `.mcp.json` missing/deleted → `writeMcpConfig` create-or-updates; never errors on absence.
- `plugin install` self-probe when server not running → `.mcp.json` still parses (init wrote it); `GET /api/health` fails → that line reports ✗ "server not reachable at `<port>` — run `claudepanion serve`"; plugin activation result reported independently; still exit 0.
- Hard errors only (settings.json unwritable, home missing) → non-zero exit, preserving current behavior.
- Multi-server / multi-home concurrency remains a pre-existing single-home assumption — a noted limitation, not addressed here.

## Testing Strategy

Claude Code itself cannot be driven in automated tests, so coverage is on file outputs, the shell-out seam, and a documented manual acceptance run.

- **`tests/server/mcp-config.test.ts`** — correct `.mcp.json` shape per port; idempotent (`written:false` when unchanged); rewrites on port change; creates when absent.
- **`tests/cli/claude-plugin.test.ts`** — `ensureClaudePluginManifest`: manifests parse, version from injected value, idempotent, `.claude-plugin` symlink → real-dir replacement. `activatePlugin` with an injected fake `spawn`: asserts the exact `claude` argv sequence (`marketplace add` → `marketplace update local` on already-known → `install`); `claude`-absent returns the structured fallback with the command list; command-failure surfaces `reason:"command-failed"`.
- **`tests/cli/init.test.ts`** (additions) — after `runInit`, `~/.claudepanion/.claude-plugin/{plugin.json,marketplace.json}` and `.mcp.json` exist, parse, version matches framework `package.json`, `.mcp.json` port = 3001, all listed in `filesCreated`.
- **`tests/cli/plugin-install.test.ts`** (additions) — settings.json writes unchanged; `activatePlugin` invoked via injected spawn; self-report reflects probe result; degraded path → exit 0, hard error → non-zero.
- **`boot`→`writeMcpConfig` seam** — a focused unit asserting a non-default `PORT` yields the right `.mcp.json` (no full server boot).

### Manual Acceptance Checklist (documented; run once per release)

1. Fresh `HOME` (or a clean `~/.claudepanion`), `npm i -g claudepanion` (or `npm link`).
2. `claudepanion init` → assert `~/.claudepanion/.claude-plugin/{plugin.json,marketplace.json}` + `.mcp.json` (port 3001) exist and parse.
3. `claudepanion serve` → assert `.mcp.json` still 3001.
4. `claudepanion plugin install` → assert it shells out (or prints the fallback) and the ✓/✗ self-report is accurate.
5. Open Claude Code **in an unrelated directory**, restart the session → `/build-companion` resolves **and** a built companion's MCP tools connect.
6. Repeat step 3 as `PORT=4000 claudepanion serve` → assert `.mcp.json` updates to `:4000`.

## Explicitly Out of Scope (YAGNI)

- No `claudepanion doctor` command.
- Never write `known_marketplaces.json` / `installed_plugins.json` (authoritatively contraindicated).
- No `mcp-http.ts` / MCP protocol changes.
- One shell-out attempt + fallback (no retry/daemon logic).
- Do not fix upstream CC bug #32606 — work around it.
- The `additionalDirectories` grant stays (Issue #23 — MCP-mediated writes — is a separate thread).
- Version reconciliation limited to bumping `package.json` → `0.3.0`.
