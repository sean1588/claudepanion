---
name: build
description: Use when working on a claudepanion Build companion request — scaffolds a new companion by writing files under companions/<slug>/ and skills/<slug>/ via the build_complete MCP tool.
---

# Build a new claudepanion companion

Triggered when the user has submitted a pending Build request describing a companion they want to exist. Your job: design it, scaffold it, and hand back a markdown summary.

## Process

1. **Read the request.** `build_list` → find the pending one → note its `id` and `version`.
2. **Gather requirements.** If the description is ambiguous, ask the user directly (they're in a Claude Code session — talk to them). Topics to pin down: what the companion does, what its UI looks like, what artifact it produces, whether it follows the standard polling pattern (list/claim/log/complete) or something bespoke.
3. **Choose a slug.** `^[a-z][a-z0-9-]*$`. Verify uniqueness by listing `companions/*/manifest.json`. Slug is lowercased, kebab-case, short.
4. **Claim.** `build_claim({ id, expectedVersion })`. Status moves → running.
5. **Design the files.** For polling-pattern companions (the common case), expect:
   ```
   companions/<slug>/
     manifest.json           { slug, name, description, icon? }
     tools/
       list.ts               thin wrapper around store.list
       claim.ts              thin wrapper around store.claim + broadcast
       log.ts                thin wrapper around store.log + broadcast
       complete.ts           companion-specific completion logic
     ui.ts                   renderPage that produces SRH for /c/<slug>
     store.ts                one-liner: export const store = createRequestStore('<slug>');
     routes.ts               one-liner: export default store.buildRouter();
   skills/<slug>/SKILL.md    companion-specific behavioral skill
   ```
6. **Log progress.** `build_log({ id, message })` after each major step. Short, imperative: "writing manifest", "writing 4 tool files", etc.
7. **Complete.** Call `build_complete({ id, files, summary })` where:
   - `files` is an array of `{ path, content }`. Paths are repo-relative and must be under `companions/<slug>/` or `skills/<slug>/`. No other locations.
   - `summary` is markdown the UI will render. Include: what was scaffolded, how to activate (restart command if not in dev mode), how to navigate to the new companion.
8. If you encounter any failure mid-way, call `build_complete({ id, error: '<message>' })` instead. Partial files will not be written to disk (server stages atomically).

## Key references

- Companion contract: `docs/companion-contract.md` — authoritative.
- Reference implementation: `companions/build/` itself is a working polling-pattern companion. Read it, copy the shape.
- Types: `src/types.ts` defines `McpToolDefinition`, `CompanionContext`, `Companion`.
- Polling helper: `src/helpers/requestStore.ts` — use `createRequestStore(slug)` for any companion that follows the pending → claim → log → complete pattern.

## Common mistakes

- Placing the companion skill inside `companions/<slug>/SKILL.md`. It must be at `skills/<slug>/SKILL.md` (plugin root) to be discoverable by Claude Code.
- Forgetting `const store = createRequestStore(slug);` import in tool files — each tool file imports the companion's `store.js`.
- UI that's not server-rendered — this repo uses SRH + vanilla JS + SSE. No React, no build step.
- Prefix confusion — the companion's tool files export `name: 'list'`, not `name: 'build_list'`. The platform applies the `<slug>_` prefix at registration.

## When you're done

Remind the user in the summary that if the server isn't running in dev mode (`claudepanion dev`), they need to restart (`Ctrl-C`, then `claudepanion serve`) to activate the new companion.
