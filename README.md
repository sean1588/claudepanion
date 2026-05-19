# claudepanion

A localhost companion host for [Claude Code](https://claude.com/claude-code). Build small single-user web apps — *companions* — whose backend work is performed by Claude Code over MCP. The browser UI is a launcher and per-companion interface; Claude Code — guided by skills loaded from `~/.claudepanion/` — is the agent that picks up pending work and streams progress back to the UI.

Packaged as a Claude Code plugin — once installed, Claude automatically discovers claudepanion's MCP tools and skills in every session (global install) or per repo (`--repo`).

<img width="3814" height="1854" alt="image" src="https://github.com/user-attachments/assets/ea64ad66-0e0b-4e4b-8fe0-a605390c2179" />


---

## Quick start

Install the framework globally:

```bash
npm install -g claudepanion
```

Initialize your personal install (one-time, idempotent):

```bash
claudepanion init
```

This creates `~/.claudepanion/` — a Git-able directory holding your companions, skills, and runtime data. The framework's Build companion and `claudepanion-host` runtime are symlinked in automatically.

Register claudepanion with Claude Code:

```bash
claudepanion plugin install          # global: loads in every Claude Code session
# or
claudepanion plugin install --repo   # per-repo: writes to <repo>/.claude/settings.local.json
```

Start the server:

```bash
claudepanion serve                   # http://localhost:3001
```

Open <http://localhost:3001>. Start a **new** Claude Code session if you just installed — plugins load at session start.

### Optional: version-control your install as a dotfile

```bash
cd ~/.claudepanion
git init
git remote add origin git@github.com:you/my-claudepanion.git
git add . && git commit -m "initial"
git push -u origin main
```

On a new machine: `npm install -g claudepanion && git clone <your-repo> ~/.claudepanion && cd ~/.claudepanion && npm install`.

### Uninstall

```bash
claudepanion plugin uninstall
npm uninstall -g claudepanion
# optionally: rm -rf ~/.claudepanion
```

### Dev mode (hacking on the framework itself)

```bash
git clone https://github.com/sean1588/claudepanion
cd claudepanion
npm install
npm link                             # registers this checkout as the global "claudepanion"
claudepanion init                    # repoints ~/.claudepanion/'s symlinks at the checkout
npm run dev                          # tsx-watch on the framework
```

---

## How it works

You submit a request in the browser (e.g., "scaffold a companion that reads a URL and produces a markdown summary"). It writes to a JSON file. A Claude Code session — guided by the skill loaded from `~/.claudepanion/skills/` — sees the pending request via an MCP tool, claims it, does the work, streams progress back, and produces an artifact. The artifact renders in the UI.

No server-side LLM calls. Claude Code is the agent.

## Included companions

Only **🔨 Build** ships by default. Build scaffolds new companions from a plain-English description and iterates on existing ones. Everything else is something you scaffold or install.

Under the hood, Build delegates the mechanical scaffolding work (registry codegen, dependency install, `npm run build`, server remount, validator + smoke check) to the `claudepanion scaffold` CLI. The build skill at `~/.claudepanion/skills/build-companion/SKILL.md` walks Claude Code through the flow: interpret the description → author four files → run scaffold → branch on the structured result → ask before committing.

## Installing more companions

Click **+ Install companion** in the sidebar, or visit <http://localhost:3001/install>. v1 accepts any npm package matching `claudepanion-<slug>`. The package must export a `RegisteredCompanion`; the host runs `npm install`, dynamically imports it, validates against the contract, and mounts it without a restart. The installed companion is persisted to `~/.claudepanion/companions/index.ts` so it survives server restart.

## Companion anatomy

Every companion lives under `~/.claudepanion/companions/<slug>/`. Two kinds:

**`ui` kind** (form + run lifecycle + markdown artifact). Four authored files:

- `manifest.ts` — name, kind, displayName, icon, description, `contractVersion: "2"`, version
- `types.ts` — a Zod **`InputSchema`** describing what the form collects, with `.meta({ ui: ... })` hints for dropdowns / groups / `optionsFrom`-populated selects, plus optional typed extras on the artifact (for list-row badges or future filtering)
- `server/tools.ts` — proxy tools authored with `defineTool({ name, description, schema, handler, sideEffect? })`. Generic entity tools (`_get` / `_list` / `_update_status` / `_append_log` / `_save_artifact` / `_fail`) are auto-registered by the host.
- `~/.claudepanion/skills/<slug>-companion/SKILL.md` — the playbook Claude Code follows when the slash command fires (note: nested directory, literal filename `SKILL.md`)

The host renders three pages from those files: the **form page** (auto-rendered from `InputSchema`), the **list page** (one row per past run), and the **detail page** (the markdown artifact). Companions can override any of those three by dropping a `form.tsx`, `pages/Detail.tsx`, or `pages/List.tsx` on disk — presence-on-disk is the contract; no manifest flag.

UI-kind companions produce **markdown artifacts**. Every run's user-facing output is a single markdown blob (`BaseArtifact.markdown`); the host renders it through `<MarkdownArtifactPanel>`. Typed fields on the artifact are optional and reserved for list-row badges or programmatic use — *rendering* is always the markdown.

`~/.claudepanion/companions/<slug>/index.ts` and the top-level `~/.claudepanion/companions/index.ts` and `~/.claudepanion/companions/client.ts` are auto-generated by `claudepanion scaffold` (carrying an `// AUTO-GENERATED` banner). They stay tracked in git so a fresh clone of your dotfile repo builds without first running the CLI.

**`tool` kind** (MCP tools only, no form, no lifecycle, auto-generated About page):

- `manifest.ts` (with `kind: "tool"`)
- `server/tools.ts` — `defineTool({...})` entries; the About page surfaces metadata in a Try-it panel
- optional `~/.claudepanion/skills/<slug>-companion/SKILL.md` (typically a brief "use these tools when X" guide)

Reference companion: `~/.claudepanion/companions/build/` (the only one shipped by default — UI-kind, with a custom `form.tsx` override for the new/iterate tab UI; symlinked from the framework package by `claudepanion init`).

The full contract reference is at [`docs/scaffold-spec.md`](./docs/scaffold-spec.md). The design that produced the current (v2) contract is captured in [`docs/superpowers/specs/2026-05-09-scaffold-consistency-design.md`](./docs/superpowers/specs/2026-05-09-scaffold-consistency-design.md).

## Philosophy

- **Reference architecture first, framework second.** Fork it, strip Build, adapt to your needs. Or keep Build and use it to grow your own company of companions.
- **Claude Code is the backend.** claudepanion doesn't call an LLM API. Everything intelligent happens in Claude Code sessions connected via MCP.
- **Localhost only, single user.** No auth, no multi-tenancy, no marketplace. This is developer tooling.

## Documentation

- [Concept](./docs/concept.md) — thesis, owned tensions, near-term unresolved questions
- [Companion contract reference](./docs/scaffold-spec.md) — the authoritative spec for the v2 companion shape
- [Latest design spec](./docs/superpowers/specs/2026-05-09-scaffold-consistency-design.md) — the v2 redesign that produced the current contract (schema-driven forms, markdown artifacts, scaffold CLI)
- [Implementation plans](./docs/superpowers/plans/) — historical plan docs in build order
- [Troubleshooting](./docs/troubleshooting.md) — common issues

## License

Apache 2.0 — see [LICENSE](./LICENSE).
