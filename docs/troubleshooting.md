# Troubleshooting

## The UI shows a pending entity forever

Claude Code hasn't run the slash command yet. Check:

1. Is Claude Code running in the claudepanion repo (or a repo that has claudepanion installed as a plugin)?
2. Did Claude see the MCP tools? Ask it: *"What MCP tools do you have from claudepanion?"* Expect the six generic entity tools per entity companion: `<companion>_get`, `_list`, `_update_status`, `_append_log`, `_save_artifact`, `_fail`, plus each companion's domain tools.
3. Copy the slash command from the detail page's "HAND OFF TO CLAUDE" block and paste it into Claude Code.

## MCP tools don't appear in Claude Code

1. Is the server running? `lsof -i :3001` — you should see `node`.
2. Does the repo you launched Claude Code in have a `.mcp.json` pointing at `http://localhost:3001/mcp`? (The claudepanion repo ships one.)
3. Did you start a new Claude Code session after the server came up? MCP connections are made at session start.
4. Still nothing? Try `/mcp` in Claude Code to see connection status, or check the server stderr.

## Server won't start: port in use

```bash
PORT=3002 npm start
```

Or find and stop the other process: `lsof -i :3001`. If you change the port, also update `.mcp.json` and `vite.config.ts`'s proxy target.

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
