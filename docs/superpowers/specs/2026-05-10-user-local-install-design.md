# User-local install (Option B) — design

**Date:** 2026-05-10
**Status:** Brainstormed → spec → implementation plan pending
**Predecessor:** [2026-05-09 scaffold-consistency redesign](2026-05-09-scaffold-consistency-design.md) (v2 contract — merged on `main`)

## Summary

Today, using claudepanion means cloning the framework repo and committing your personal companions into it. This conflates two things with very different release cadences: the **framework** (host runtime, build skill, primitives) and the **user's personal companions** (their PR reviewer, their oncall investigator, their reading tracker).

This design splits them. The framework becomes a single `npm install -g claudepanion`. The user's companions, skills, data, and any installed third-party companions live in `~/.claudepanion/`, a Git-able directory created on first run. `claudepanion serve` runs the framework binary against the user-local directory; symlinks bridge the two so framework-owned content (the Build companion, its skill, the runtime library) appears inside `~/.claudepanion/` without bloating the user's git history.

Outcomes:
- Users can `npm install -g claudepanion` instead of cloning a framework repo.
- A user's personal companions live in their own Git-able directory — the dotfiles pattern.
- The framework upgrades via npm; user content stays untouched.
- The build skill auto-committing companions into the framework repo (the failure mode we fixed in PR #20) becomes architecturally impossible.

## Background

The v2 redesign (shipped PR #20) moved scaffold mechanics into `claudepanion scaffold`, made forms schema-driven, made artifacts markdown, and relocated `data/` and `cache/` to `~/.claudepanion/`. That last change was deliberately the "Option C" half-step toward this design — the runtime root and the user-data root are already separable. This design completes the move.

The earlier deferred-design note ([Notion: User-local install](https://www.notion.so/35c71f4cdd628194a208c9191d37e767)) captured the rough shape. This spec is the synthesis after the 2026-05-10 brainstorm, with the open questions resolved.

## Decisions

Four foundational decisions (taken during the 2026-05-10 brainstorm):

1. **Plugin scope:** `claudepanion plugin install` writes to `~/.claude/settings.json` (global) by default. `--repo` opts into per-repo `<git-root>/.claude/settings.local.json` for sandboxed cases.
2. **Install layout:** A single `~/.claudepanion/` per user is the runtime root for companions, skills, data, cache, and the user-owned `package.json`. No named profiles in v1.
3. **Framework binding:** A single `npm install -g claudepanion` provides the framework. `claudepanion init` symlinks the global package's framework into `~/.claudepanion/node_modules/claudepanion-host` so companion imports resolve. No per-install version pinning in v1.
4. **First-run UX:** `claudepanion serve` auto-runs `init` when `~/.claudepanion/` is missing; otherwise just starts the server. `init` and `plugin install` stay as separate steps.

## Architecture

Two layers, machine-wide:

```
┌─ Framework (one global install per machine) ──────────────────┐
│  npm install -g claudepanion                                  │
│  Lives at: <global-pkg-root>/                                 │
│  Contents: server, primitives, watcher, scaffold CLI,         │
│            Build companion + its skill, init/migrate logic    │
│  Upgrades: npm install -g claudepanion@latest                 │
└───────────────────────────────────────────────────────────────┘
                              │  symlinks created at init
                              ▼
┌─ User-local install (one Git-able dir per user) ──────────────┐
│  ~/.claudepanion/                                             │
│  ├── package.json          ← real, user-owned (extra deps)    │
│  ├── .gitignore            ← real                             │
│  ├── companions/                                              │
│  │   ├── build/            → symlink to framework's Build     │
│  │   └── <slug>/           → real files (scaffolded)          │
│  ├── skills/                                                  │
│  │   ├── build-companion/  → symlink to framework's skill     │
│  │   └── <slug>-companion/ → real files                       │
│  ├── data/                 ← real, gitignored                 │
│  ├── cache/                ← real, gitignored                 │
│  ├── dist/                 ← real, gitignored                 │
│  └── node_modules/                                            │
│      └── claudepanion-host → symlink to global pkg root       │
└───────────────────────────────────────────────────────────────┘
```

**Ownership rule:** framework-owned content is symlinked from the global package; user-owned content is real files. A `git status` on `~/.claudepanion/` shows only the user's companions, never framework innards.

`claudepanion serve` runs the framework binary with `cwd: ~/.claudepanion/`, so the watcher, codegen, and data layer all operate against the user-local root transparently.

The Claude Code plugin marketplace points at `~/.claudepanion/` (not the global). Claude Code then sees one cohesive plugin combining the framework's Build skill (symlinked) and any user-local companion skills.

## CLI surface

```
claudepanion init                      [NEW] bootstrap or repair ~/.claudepanion/ (idempotent)
claudepanion serve                     start the server (auto-runs `init` if ~/.claudepanion/ missing)
claudepanion plugin install            [CHANGED] default: writes ~/.claude/settings.json (global)
                                                 --repo: writes <git-root>/.claude/settings.local.json
claudepanion plugin uninstall          [CHANGED] same --repo flag, mirrors install
claudepanion scaffold <slug>           [CHANGED] operates on ~/.claudepanion/, not pkgRoot
claudepanion regenerate                [CHANGED] re-derives registry from ~/.claudepanion/companions/
claudepanion remount <slug>            unchanged
claudepanion companion delete <slug>   [CHANGED] operates on ~/.claudepanion/
claudepanion --help                    unchanged
```

**Notable behaviors:**

- `init` is **idempotent and self-healing.** Running it on an existing install refreshes symlinks (catches `nvm use` switching node versions and stranding the global path) but does NOT touch user content.
- `init` refuses to clobber. If `~/.claudepanion/` exists but doesn't look like a claudepanion install (no `package.json`, or `package.json.name !== "claudepanion-home"`), `init` errors out and does nothing. `--force` overrides.
- `serve` auto-runs `init` only when `~/.claudepanion/` doesn't exist. Subsequent runs never mutate the user-local install.
- All scaffold / regenerate / delete operations resolve cwd to `~/.claudepanion/` regardless of where the user invokes the CLI from. Today these depend on `process.cwd()` being the framework repo — Option B inverts that contract.
- No `claudepanion upgrade` command. `npm install -g claudepanion@latest` IS the upgrade. Symlinks repoint via `init` if the global path changed.
- No `claudepanion doctor` command in v1. Add later if "things aren't working" support requests warrant it.

## First-run flow

```
$ npm install -g claudepanion
# … npm output …

$ claudepanion serve
~/.claudepanion/ not found. Initialize a new claudepanion home? [Y/n] y

  ✓  ~/.claudepanion/                    created
  ✓  ~/.claudepanion/package.json        created
  ✓  ~/.claudepanion/.gitignore          created
  ✓  ~/.claudepanion/companions/build/   linked → framework
  ✓  ~/.claudepanion/skills/build-companion/ linked → framework
  ✓  ~/.claudepanion/node_modules/claudepanion-host  linked → framework
  ✓  ~/.claudepanion/data/, cache/, dist/  created (gitignored)

  Tip: run 'claudepanion plugin install' to expose claudepanion to Claude Code,
       then start a new Claude Code session.

  Starting server on http://localhost:3001 …
```

### Init template — files created (real, user-owned)

- `package.json` (minimal):
  ```json
  {
    "name": "claudepanion-home",
    "private": true,
    "type": "module",
    "dependencies": {}
  }
  ```
  Companions install their SDKs into this — `npm install @aws-sdk/client-cloudwatch-logs`, `npm install @octokit/rest`, etc. The `+ Install companion` UI button adds installed packages here too.

- `.gitignore`:
  ```
  node_modules/
  data/
  cache/
  dist/
  .env
  .env.*
  ```
  Recommends gitignoring transient state but leaves `companions/`, `skills/`, `package.json`, `package-lock.json` tracked. Users can `git init ~/.claudepanion && git remote add origin <their-repo>` to version-control their setup as a dotfile.

- `data/`, `cache/`, `dist/` — empty dirs.

### Init template — symlinks (framework-owned)

- `companions/build/` → `<global-pkg-root>/companions/build/`
- `skills/build-companion/` → `<global-pkg-root>/skills/build-companion/`
- `node_modules/claudepanion-host/` → `<global-pkg-root>/`

Every `init` refreshes these — switches across node versions don't leave them stranded.

## Migration

**Sean (the only existing user, today):** trivial because the cloudwatch-investigator dogfood was never committed and the framework repo has no personal companions. After this design ships:

```bash
npm install -g claudepanion   # global install of latest published version
claudepanion init             # creates ~/.claudepanion/ from scratch
```

The cloned framework repo at `~/github/sean1588/claudepanion/` becomes a **development checkout**, not a runtime install.

**Hypothetical future users with companions in a cloned framework repo:** out of scope for v1. A one-time `claudepanion migrate-from-clone <path>` could copy `companions/<non-build>/*` and `skills/<non-build-companion>/*` into `~/.claudepanion/`. Defer until anyone actually needs it.

## Dogfooding (framework dev)

Standard `npm link`. From the framework checkout:

```bash
cd ~/github/sean1588/claudepanion
npm link                              # registers this checkout as the global "claudepanion"
                                      # — overrides whatever `npm install -g` put there

cd ~/.claudepanion
claudepanion init                     # re-runs symlink refresh; now points at the checkout
```

After this, edits in `~/github/sean1588/claudepanion/companions/build/` are immediately live in `~/.claudepanion/companions/build/` (it's a symlink). `npm run dev` from the framework checkout rebuilds dist; the watcher picks up changes.

To unwind dogfooding:

```bash
cd ~/github/sean1588/claudepanion && npm unlink
npm install -g claudepanion           # back to published version
claudepanion init                     # re-link to npm's global path
```

**Open detail:** the framework's `companions/build/` is TypeScript source; the server reads compiled output. Dogfooding requires `npm run build` (or `npm run dev` for watch) in the framework checkout. Same constraint as today, just called out.

## Framework upgrades

`npm install -g claudepanion@latest` updates the package in place. Symlinks point at the package's resolved path (not a versioned subpath), so they keep working.

**Contract-version drift** is a real concern when the framework supports `contractVersion: "2"` and a user has companions on `"1"`. The validator already rejects unsupported contract versions at startup — the companion shows a validation error in the UI and won't load. A future `claudepanion migrate-companion <slug>` could automate updates. Out of scope for v1; document the workaround (manual edit + bump) in troubleshooting if it comes up.

## Companion install (existing UI button)

Today `+ Install companion` calls `POST /api/install` which runs `npm install claudepanion-<slug>` in cwd. In the new world, cwd is `~/.claudepanion/`, so the package gets added to `~/.claudepanion/package.json` dependencies and `node_modules/`. The host imports, validates, registers — same flow, different location.

The user can `git commit package.json && git push` to version-control their installed-companion list across machines, dotfile-style. On a new machine, `git clone <their-repo> ~/.claudepanion && npm install` brings everything back.

## Plugin install + marketplace pointing

`claudepanion plugin install` (default global) writes:

```json
{
  "enabledPlugins": { "claudepanion@local": true },
  "extraKnownMarketplaces": {
    "local": { "source": { "source": "directory", "path": "/home/<user>/.claudepanion" } }
  }
}
```

…to `~/.claude/settings.json`. Claude Code reads from `~/.claudepanion/` and discovers `skills/build-companion/` (symlinked from framework) plus any user-local `skills/<slug>-companion/` directories. Plugins are merged from all reachable settings layers, so this loads in every Claude Code session by default.

`--repo` writes the same structure to `<git-root>/.claude/settings.local.json`. The marketplace source still points at `~/.claudepanion/` — the only difference is which Claude Code config file holds the `enabledPlugins` entry.

Per-repo opt-out remains possible by setting `enabledPlugins["claudepanion@local"] = false` in a repo's local settings — Claude Code's merge logic respects this.

**Precondition:** `plugin install` requires `~/.claudepanion/` to exist (the marketplace `source.path` points there). If invoked before `init`, the CLI prints a friendly error directing the user to run `claudepanion init` first. `serve`'s auto-init covers the typical first-run path; `plugin install` is the only other CLI entry point that depends on the user-local install existing.

## Where the code changes

**`bin/cli.js`** — biggest surface area:
- Resolve `~/.claudepanion/` (override via `CLAUDEPANION_HOME` env var for tests)
- `init` command: new
- `serve`: spawn server with `cwd: ~/.claudepanion/`, auto-run init if missing
- `plugin install/uninstall`: `--repo` flag; default writes `~/.claude/settings.json`; marketplace source = `~/.claudepanion/`
- `scaffold`, `regenerate`, `companion delete`: pass `~/.claudepanion/` as cwd to the underlying functions

**`src/cli/init.ts`** — new file:
- `runInit({ home, force })`: creates user-local layout, refreshes symlinks idempotently
- Detects `npm link`-mode (global path is a symlink to a dev checkout) and follows through transparently
- Refuses to clobber non-empty non-claudepanion dirs unless `--force`

**`src/cli/scaffold.ts`, `src/cli/regenerate.ts`** — already take `cwd` as input. CLI passes `~/.claudepanion/` instead of `process.cwd()`.

**`src/server/index.ts`** — already uses `process.cwd()` as `repoRoot`. With cwd switched to `~/.claudepanion/` by the CLI, no in-server change needed.

**`src/server/paths.ts`** — already resolves `~/.claudepanion/data/` and `cache/`. No changes.

**`package.json` (framework)** — `files` entry must include `companions/build/`, `skills/build-companion/`, the compiled `dist/`, and the CLI so the published npm package contains everything needed. New `main` and `bin` entries if not already correct for global install.

## Testing strategy

- **Unit tests** for `runInit`:
  - Fresh empty dir → creates layout correctly
  - Existing claudepanion home → idempotent; symlinks refreshed; user files untouched
  - Existing non-claudepanion dir with files → refuses without `--force`
  - `--force` → overwrites
  - Detects npm-link mode (global is a symlink → follows through)
- **Unit tests** for `plugin install/uninstall` with `--repo`:
  - Default writes `~/.claude/settings.json`
  - `--repo` writes `<git-root>/.claude/settings.local.json`
  - Uninstall mirrors install correctly
- **Integration test** for CLI with `CLAUDEPANION_HOME` pointing at a temp dir:
  - Full flow: `init` → scaffold a fake companion → serve detects it
- **Manual / dogfood test:** Sean re-runs the v2 dogfood flow against his `~/.claudepanion/` after `npm link`-ing his framework checkout.

## Out of scope for v1

- Contract-version migration tooling (`claudepanion migrate-companion`) — deferred until someone hits a v1→v2 drift in the wild
- `claudepanion doctor` — deferred per the brainstorm
- `claudepanion migrate-from-clone` — deferred; no users with existing personal companions
- Named profiles (`~/.claudepanion/profiles/<name>/`) — deferred; no real use case yet
- A Companion Hub / npm-style registry UX — separate product question; v1 leans on npm directly
- Windows-specific symlink handling — v1 targets macOS / Linux; WSL works

## Open questions

None blocking. Items called out inline as future considerations:

- How does the UI surface a contract-version mismatch beyond the current validator error? Possibly a future migration banner.
- Should `init` print an "and now run `claudepanion plugin install`" reminder, or should the first-run UX skip it and let users discover the Quickstart? Tentatively: print the reminder; revisit if it's noise.

## Glossary

- **Framework** — the published `claudepanion` npm package. Server, primitives, watcher, scaffold CLI, Build companion, init logic. Global install per machine.
- **User-local install** — `~/.claudepanion/`. Per-user runtime root containing user companions, skills, data, cache, and the user-owned `package.json`. Created by `claudepanion init`.
- **Global package** — the framework, installed via `npm install -g claudepanion`. Lives at e.g. `~/.npm-global/lib/node_modules/claudepanion/`.
- **`claudepanion-host`** — the runtime library exported by the framework package for companion imports (`defineTool`, `BaseArtifact`, etc.). Symlinked into `~/.claudepanion/node_modules/`.
- **Marketplace source** — the directory Claude Code reads to discover plugin contents. Pointed at `~/.claudepanion/`, not the global package, so user-local skills are visible alongside the symlinked framework Build skill.
