# claudepanion

A localhost companion host for [Claude Code](https://claude.com/claude-code). Build small single-user web apps — *companions* — whose backend work is performed by Claude Code over MCP. The browser UI is a launcher and per-companion interface; Claude Code, running in the claudepanion repo, is the agent that picks up pending work and streams progress back to the UI.

Packaged as a Claude Code plugin — once installed in a repo, Claude automatically discovers claudepanion's MCP tools and skills.

---

## Quick start

```bash
npm install
npm run build
npm start                     # serves http://localhost:3001
```

Open <http://localhost:3001>. Start a new Claude Code session in the claudepanion repo and the MCP tools plus the bundled skills will load automatically (the repo ships a `.mcp.json` and a `.claude-plugin/plugin.json`).

Dev mode (hot-reload):

```bash
npm run dev                   # vite on :5173 + tsx-watch on :3001
```

---

## How it works

You submit a request in the browser (e.g., "scaffold a companion that reads a URL and produces a markdown summary"). It writes to a JSON file. A Claude Code session — guided by the bundled skill — sees the pending request via an MCP tool, claims it, does the work, streams progress back, and produces an artifact. The artifact renders in the UI.

No server-side LLM calls. Claude Code is the agent.

## Built-in companion: Build

The only companion that ships is **Build**. It's both:

- The first thing you interact with when you land on claudepanion — it scaffolds new companions from a plain-English description.
- The reference implementation every companion should follow. Reading `companions/build/` teaches you the pattern.

Use Build to create your own companions: oncall investigators, research briefs, repetitive code reviews, anything where you want a browser UI in front of a Claude-mediated workflow.

## Companion anatomy

Every companion lives under `companions/<slug>/`. Two kinds:

**`entity` kind** (has lifecycle, form, artifacts):
- `manifest.ts` — name, kind, displayName, icon, description, contractVersion, version
- `index.ts` — re-exports a `RegisteredCompanion`
- `types.ts` — `Input` and `Artifact` TypeScript interfaces
- `form.tsx` — React form that submits an `Input`
- `pages/List.tsx` — row renderer for the list page
- `pages/Detail.tsx` — artifact body component
- `server/tools.ts` — domain MCP tools (generic `_get`/`_list`/`_update_status`/`_append_log`/`_save_artifact`/`_fail` are auto-registered)

**`tool` kind** (MCP tools only, auto-generated About page):
- `manifest.ts`, `index.ts`
- `server/tools.ts` — use `defineTool(handler, { description, params })` to surface metadata on the About page's Try-it panel

Plus a skill at `skills/<slug>-companion.md` in the repo root.

Reference companions: `companions/build/` (entity), `companions/expense-tracker/` (entity), `companions/homelab/` (tool).

See the [design spec](./docs/superpowers/specs/2026-04-22-claudepanion-ux-redesign-design.md) for the full contract.

## Philosophy

- **Reference architecture first, framework second.** Fork it, strip Build, adapt to your needs. Or keep Build and use it to grow your own company of companions.
- **Claude Code is the backend.** claudepanion doesn't call an LLM API. Everything intelligent happens in Claude Code sessions connected via MCP.
- **Localhost only, single user.** No auth, no multi-tenancy, no marketplace. This is developer tooling.

## Documentation

- [Architecture](./docs/architecture.md) — MCP lifecycle, transport, SSE, session mechanics
- [Companion contract](./docs/companion-contract.md) — authoritative spec for building companions
- [Troubleshooting](./docs/troubleshooting.md) — common issues

## License

Apache 2.0 — see [LICENSE](./LICENSE).
