# Companion Contract

This is the authoritative spec for building claudepanion companions. If you're scaffolding via `/build`, the Build skill reads this file to know what to generate.

## Directory layout

```
companions/<slug>/
├── manifest.json        required
├── tools/*.ts           required, one file per tool
├── ui.ts                required
├── store.ts             optional (thin wrapper around helper — recommended)
└── routes.ts            optional (for browser mutations)

skills/<slug>/SKILL.md   required if the companion needs Claude-facing instructions
```

The skill **must** live at `skills/<slug>/SKILL.md` at the plugin root. Claude Code's plugin discovery only scans `skills/<name>/SKILL.md` — nested paths inside `companions/<slug>/` are not discovered.

## `manifest.json`

```json
{
  "slug": "my-companion",
  "name": "My Companion",
  "description": "One sentence. Shown in the UI nav.",
  "icon": "⚡"
}
```

- `slug` matches `^[a-z][a-z0-9-]*$`. Used to prefix MCP tool names, as the URL path, and as the data file name.
- Unique across all companions in the repo (enforced at boot).

## `tools/*.ts`

Each file default-exports an `McpToolDefinition`:

```ts
import { z } from 'zod';
import type { McpToolDefinition } from '../../../src/types.js';
import { successResult } from '../../../src/types.js';

const tool: McpToolDefinition<{ foo: string }> = {
  name: 'do_something',                             // prefixed to "<slug>_do_something"
  description: '[my-companion] Does something.',    // bracket tag helps Claude disambiguate
  schema: { foo: z.string() },
  async handler({ foo }, ctx) {
    ctx.broadcast('my-companion.did_something', { foo });
    return successResult({ ok: true });
  },
};

export default tool;
```

## `ui.ts`

```ts
import type { CompanionContext } from '../../src/types.js';

export async function renderPage(ctx: CompanionContext): Promise<string> {
  return `<h1>${ctx.slug}</h1>`;
}
```

Returned HTML is injected into the platform layout (sidebar + chrome). Client behavior goes in `<script>` blocks. Platform provides globals: `api(method, path, body)`, `sse: EventSource`, `showToast(msg)`.

## `store.ts` and `routes.ts` (polling pattern)

For companions following the list/claim/log/complete pattern, this is the shape:

```ts
// store.ts
import { createRequestStore } from '../../src/helpers/requestStore.js';
export const store = createRequestStore('my-companion');

// routes.ts
import { store } from './store.js';
export default store.buildRouter();
```

`buildRouter()` returns an Express router with:
- `POST /requests` — create a request from `{ description }`
- `POST /requests/:id/reset` — force status back to `pending`
- `GET /requests` — list
- `GET /requests/:id` — detail

Mounted at `/api/c/<slug>/*`.

## `CompanionContext`

What handlers and `renderPage` receive:

```ts
{
  slug: string;
  broadcast(event: string, data: unknown): void;   // push SSE to UI
  store: CompanionStore<unknown>;                   // read/write data/<slug>.json
  log(...args: unknown[]): void;                    // structured stderr
}
```

## Events

Event names follow `<slug>.<verb>` by convention. Examples:
- `<slug>.request_created`
- `<slug>.request_updated`
- `<slug>.log_appended`

The platform reserves `platform.*` for host-level events.

## File-writing companions (advanced)

Companions that write files to the repo (like Build) must validate every path is under `companions/<slug>/` or `skills/<slug>/`. Writes must be atomic: stage to a `.claudepanion-stage-<id>/` directory, verify no collisions at destinations, then `mv` each file into place. See `companions/build/tools/complete.ts` for the canonical pattern.

## What the platform will NOT do

- Lifecycle hooks (no `onStart`/`onStop`).
- Inter-companion communication (no shared state, no event bus between companions — each companion is isolated).
- Authentication. Localhost only.
- Hot-reload. New companions need a server restart (auto in `claudepanion dev`).
