# Troubleshooting

## The UI shows a pending entity forever

Claude Code hasn't run the slash command yet. Check:

1. Is Claude Code running in the claudepanion repo (or a repo that has claudepanion installed as a plugin)?
2. Did Claude see the MCP tools? Ask it: *"What MCP tools do you have from claudepanion?"* Expect the six generic entity tools per entity companion: `<companion>_get`, `_list`, `_update_status`, `_append_log`, `_save_artifact`, `_fail`, plus each companion's domain tools.
3. Copy the slash command from the detail page's "HAND OFF TO CLAUDE" block and paste it into Claude Code.

## MCP tools don't appear in Claude Code

1. Is the server running? `lsof -i :3001` — you should see `node`. If not, run `claudepanion serve` (or `npm start` from the claudepanion repo).
2. Is the plugin installed in the repo you're running Claude Code from? `claudepanion plugin install` adds the right entries to `<repo>/.claude/settings.local.json`. You can check with `/plugin` in Claude Code — `claudepanion@local` should be listed.
3. Did you start a new Claude Code session after installing? Plugins load at session start, not mid-session.
4. Still nothing? Check `<repo>/.claude/settings.local.json` has `enabledPlugins["claudepanion@local"] = true` and an `extraKnownMarketplaces.local` entry pointing at your claudepanion checkout.

## `/build-companion` skill isn't recognized

The plugin is probably not registered (which also means MCP tools are likely working via a bare `.mcp.json` but skills aren't loading). Run `claudepanion plugin install` in the repo where Claude Code is running, then **start a new Claude Code session**. Verify with `/plugin` in Claude Code — if `claudepanion@local` doesn't appear, re-run install and check `.claude/settings.local.json`.

Also verify the skill file is at `skills/build-companion/SKILL.md` in the claudepanion repo (nested directory, literal filename `SKILL.md`). A flat `skills/build-companion.md` will not be discovered by Claude Code's plugin loader.

## Server won't start: port in use

```bash
PORT=3002 claudepanion serve
```

Or find and stop the other process: `lsof -i :3001`. If you change the port, also update the target repo's `.mcp.json` and `vite.config.ts`'s proxy target.

## "duplicate slug" or "contractVersion" error on boot

Two companions in `companions/index.ts` have the same `manifest.name`, or a companion declares a `contractVersion` the host doesn't support (currently `"1"`). Check the manifests — slugs must be unique and match `^[a-z][a-z0-9-]*$`.

## Scaffolded a companion but I don't see it in the sidebar

The sidebar polls `/api/companions` every 5s — give it a moment. If it still doesn't appear:

1. Does `companions/index.ts` include the new companion's import + export-array entry? (Build's skill rewrites this file; if it failed, the companion isn't mounted.)
2. Did the build complete? The watcher imports compiled `dist/companions/<name>/index.js`. Run `npm run build` (or have `npm run dev` running so `tsc --watch` rebuilds automatically).
3. Check the server stderr for `[watcher] could not re-import <name>` or validation-failure messages.
4. Hit `/api/reliability/<name>` directly — if it returns 404, the companion isn't in the registry; if it returns a report with `validator.ok: false`, the fatal issues are listed.

## Install flow says "npm install failed"

The full stderr from npm is rendered on the page. Common causes:
- Package doesn't exist on the registry (404).
- Package exists but the name doesn't start with `claudepanion-` (client-side validation blocks, but a hand-crafted request would hit server-side validation).
- No network access.

## Tests failing with "module not found" for `.js` imports

This project uses Node ESM. Imports of local `.ts` files must use `.js` extension: `import { x } from './foo.js'`. TypeScript rewrites this correctly. Templates under `companions/build/templates/` are excluded from `tsc` because they're source material, not compile inputs.
