# Troubleshooting

## The UI shows a pending request forever

Claude Code hasn't picked it up. Check:

1. Is Claude Code running in the claudepanion repo (or a repo with the plugin installed and activated)?
2. Did Claude see the MCP tools? Ask it: *"What MCP tools do you have from claudepanion?"* Expect `build_list`, `build_claim`, `build_log`, `build_complete`.
3. If you see tools but Claude isn't picking up requests, nudge it: *"Check `build_list` for pending work."*

## Tools don't appear in Claude Code

1. Did you run `claudepanion plugin install` in this repo? Check `.claude/settings.local.json`.
2. Is `claudepanion serve` running?
3. Did you restart your Claude Code session after installing the plugin? Plugins are loaded at session start.

## Server won't start: port in use

```bash
PORT=3002 claudepanion serve
```
Or find and stop the other process: `lsof -i :3001`.

## "duplicate slug" error on boot

Two companions have the same `slug` in their `manifest.json`. Check `companions/*/manifest.json`. Slugs must be unique.

## "invalid slug" error on boot

Slug must match `^[a-z][a-z0-9-]*$` — lowercase letters, digits, hyphens. No underscores, no uppercase, must start with a letter.

## Build scaffolded a companion but I don't see it in the nav

You're not in dev mode. Restart the server: `Ctrl-C`, then `claudepanion serve`. Or run `claudepanion dev` next time to auto-reload.

Also check: does the scaffolded companion have `manifest.json`, `ui.ts`, and at least `tools/*.ts`? Load failures skip the companion and log to stderr.

## Build fails with "path not under companions/ or skills/"

The Build tool only writes to those two directories. Ensure the skill isn't trying to write elsewhere. This is a hard safety constraint — not bypassable.

## Tests failing with "module not found" for `.js` imports

This project uses Node ESM with `"module": "NodeNext"`. Imports of local `.ts` files must use `.js` extension: `import { x } from './foo.js'`. TypeScript rewrites this correctly.

## "No active Claude Code session detected" banner persists after I open Claude Code

The banner triggers after 2 minutes of no claim. It's advisory, not authoritative. If you just started Claude Code, give it a moment and nudge it to check pending work.
