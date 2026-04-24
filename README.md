# claudepanion

A localhost companion host for [Claude Code](https://claude.com/claude-code). Build small single-user web apps — *companions* — whose backend work is performed by Claude Code over MCP. The browser UI is a launcher and per-companion interface; Claude Code, running in the claudepanion repo, is the agent that picks up pending work and streams progress back to the UI.

Packaged as a Claude Code plugin — once installed in a repo, Claude automatically discovers claudepanion's MCP tools and skills.

---

## Quick start

```bash
npm install
npm run install:global        # links the `claudepanion` CLI

# in any repo where you want to use claudepanion:
claudepanion plugin install
claudepanion serve            # starts the server on http://localhost:3001
```

Open <http://localhost:3001>. Start a new Claude Code session in the claudepanion repo (or any repo with the plugin installed) and the MCP tools plus skills will load.

To undo:
```bash
claudepanion plugin uninstall
npm run uninstall:global
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

Every companion lives under `companions/<slug>/` with:

- `manifest.json` — name, description, icon
- `tools/*.ts` — MCP tool definitions (one per file), auto-namespaced with `<slug>_` prefix
- `ui.ts` — server-rendered HTML for `/c/<slug>`
- `store.ts` — companion-owned data access (typically one line: `createRequestStore(slug)`)
- `routes.ts` — optional Express router for browser mutations

Plus a skill at `skills/<slug>/SKILL.md` at the plugin root (not inside the companion dir — Claude Code's plugin discovery only scans the root `skills/` directory).

See [`docs/companion-contract.md`](./docs/companion-contract.md) for the full spec.

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
