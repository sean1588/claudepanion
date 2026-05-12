# User-local install (Option B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the framework (one global `npm install -g claudepanion`) from the user's runtime (`~/.claudepanion/`), making the host installable without cloning the framework repo and the personal-companion layer version-controllable as a dotfile-style repo.

**Architecture:** The framework becomes a single published npm package containing the server, primitives, scaffold CLI, Build companion, and `init` logic. `claudepanion init` bootstraps `~/.claudepanion/` with real user files (package.json, .gitignore, tsconfig) plus symlinks pointing back at the global package for the Build companion, its skill, and the runtime library (`claudepanion-host`). All scaffold / serve / regenerate operations run with `cwd: ~/.claudepanion/`. The server is refactored from a hard-coded static-import of companions into a parameter-driven `bootServer({ companions, ... })` function so the CLI can dynamically wire user-local companions in at startup.

**Tech Stack:** Node.js + TypeScript (existing). `node:fs` symlink primitives, `node:os.homedir()`, child_process spawn. The CLI loads compiled framework code from the global package via `__dirname` resolution; the server loads user-local companions via dynamic `import(join(home, "dist/companions/index.js"))`.

**Spec:** [`docs/superpowers/specs/2026-05-10-user-local-install-design.md`](../specs/2026-05-10-user-local-install-design.md)

---

## File Structure

### New files

- `src/host/index.ts` — public API surface that companions import via `claudepanion-host`. Re-exports `defineTool`, `BaseArtifact`, `successResult`, `configErrorResult`, type definitions.
- `src/host/tsconfig.base.json` — base TS config the user-local install extends.
- `src/cli/init.ts` — `runInit({ home, force, frameworkRoot })` logic. Creates layout, manages symlinks idempotently, runs initial codegen + build.
- `src/server/boot.ts` — extracted server-as-library. `bootServer({ companions, port, ... })` returns a started server.
- `tests/cli/init.test.ts` — unit tests for `runInit`.
- `tests/cli/plugin-install.test.ts` — tests for `--repo` flag behavior.

### Modified files

- `bin/cli.js` — add `init` command, `--repo` flag, switch serve / scaffold / regenerate / companion-delete to user-local cwd, auto-init on first serve.
- `package.json` — drop `"private": true`, add `"files"`, `"main"`, `"exports"` mapping `claudepanion-host` to `dist/src/host/index.js`.
- `src/server/index.ts` — refactor to call `bootServer` from `src/server/boot.ts`. Remove static `import { companions }`.
- `src/server/paths.ts` — add `companionsPath()`, `skillsPath()`, `distPath()` helpers.
- `tsconfig.json` — ensure `src/host/` and `src/host/tsconfig.base.json` get published.
- `README.md` — Quickstart rewritten for `npm install -g claudepanion` flow.
- `docs/troubleshooting.md` — add a section on user-local install issues.

### Removed concerns

Nothing is deleted, but `companions/index.ts` and `companions/client.ts` at the framework-repo root **stop being the runtime registry**. They remain because they're still used by the framework's own dev mode (when running from the cloned repo with `npm run dev`). The published package's runtime instead reads from `~/.claudepanion/dist/companions/index.js`.

---

## Phase 1 — Refactor server into a bootable library

**Why first:** the server's hard-coded `import { companions } from "../../companions/index.js"` is the load-bearing blocker for Option B. Until that's parameterized, no amount of cwd manipulation makes companions load from the user-local home.

### Task 1: Extract `bootServer` into `src/server/boot.ts`

**Files:**
- Create: `src/server/boot.ts`
- Modify: `src/server/index.ts`

- [ ] **Step 1: Read the current `src/server/index.ts` end to end** to identify what becomes the boot function's body vs what stays in `index.ts` as the entry point.

- [ ] **Step 2: Create `src/server/boot.ts`** with a `bootServer` function that takes everything currently imported at module scope as parameters:

```ts
import express from "express";
import { join, resolve } from "node:path";
import { statSync } from "node:fs";
import { createEntityStore } from "./entity-store.js";
import { createRegistry, type RegisteredCompanion } from "./companion-registry.js";
import { mountApiRoutes } from "./api-routes.js";
import { buildMcpServer } from "./mcp.js";
import { createWatcher, type ReliabilitySnapshot } from "./reliability/watcher.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { dataPath, ensureClaudepanionDirs } from "./paths.js";
import { bumpMcpStatus } from "./mcp-status.js";

export interface BootOptions {
  /** Pre-resolved list of companions to register. Caller is responsible for loading these from user-local dist. */
  companions: RegisteredCompanion[];
  /** Server port (default: 3001 or PORT env). */
  port?: number;
  /** Runtime root for the watcher + codegen (where companions/*, dist/, skills/ live). Default: process.cwd(). */
  cwd?: string;
}

export async function bootServer(opts: BootOptions): Promise<void> {
  const port = opts.port ?? Number(process.env.PORT ?? 3001);
  const repoRoot = opts.cwd ?? process.cwd();
  // ... move the contents of the current index.ts startServer() body here,
  // referencing `opts.companions` instead of the static import, and `repoRoot`
  // instead of `process.cwd()`.
}
```

- [ ] **Step 3: Move all setup logic** from the current `src/server/index.ts` (TSC health check, entity store, registry creation, MCP server, transport wiring, express routes, static client, watcher creation) into the body of `bootServer`. Reference `opts.companions` wherever the old code used the static import.

- [ ] **Step 4: Run `npx tsc -p tsconfig.json --noEmit`** to confirm `boot.ts` compiles.

Expected: clean compile.

- [ ] **Step 5: Commit**

```bash
git add src/server/boot.ts
git commit -m "refactor(server): extract bootServer({ companions, cwd, port }) into boot.ts"
```

### Task 2: Make `src/server/index.ts` a thin wrapper around `bootServer`

**Files:**
- Modify: `src/server/index.ts`

- [ ] **Step 1: Replace the contents of `src/server/index.ts`** with a thin wrapper that retains today's behavior (static import of companions, default cwd) for backwards compatibility:

```ts
import { bootServer } from "./boot.js";
import { companions } from "../../companions/index.js";

void bootServer({ companions });
```

This preserves `npm run dev` / `npm start` from the framework repo as a working dev mode — the static import resolves against the framework's own `companions/index.ts`.

- [ ] **Step 2: Run the full test suite.**

Run: `npm test`
Expected: all 182 tests pass (no regressions from the refactor).

- [ ] **Step 3: Run a smoke check.**

```bash
npm run build
PORT=3099 node dist/src/server/index.js &
sleep 2
curl -s http://localhost:3099/api/companions | head -c 200
kill %1
```
Expected: JSON array containing the Build companion's manifest. Confirms the wrapper boots end-to-end.

- [ ] **Step 4: Commit**

```bash
git add src/server/index.ts
git commit -m "refactor(server): index.ts becomes a thin wrapper over bootServer"
```

---

## Phase 2 — Public host API + `tsconfig.base.json`

**Why:** companions in `~/.claudepanion/companions/` need somewhere to import `defineTool`, `BaseArtifact`, etc. from. The framework needs a published API surface for this.

### Task 3: Create `src/host/index.ts` re-exporting the companion-facing API

**Files:**
- Create: `src/host/index.ts`

- [ ] **Step 1: Identify the public surface** that the existing companion at `companions/build/server/tools.ts` (and the embedded pr-reviewer template in `skills/build-companion/SKILL.md`) imports from `src/shared/`:
  - `defineTool` (from `src/shared/define-tool.ts`)
  - `BaseArtifact`, `Entity`, `EntityStatus`, `Manifest`, `CompanionToolDefinition` (types from `src/shared/types.ts`)
  - `successResult`, `configErrorResult` (helpers from `src/shared/types.ts`)
  - `CompanionKind` (type)

- [ ] **Step 2: Write `src/host/index.ts`** as the canonical re-export point:

```ts
/**
 * Public API for companions.
 *
 * Companions in ~/.claudepanion/companions/<slug>/ import from this module via
 * the `claudepanion-host` symlink that `claudepanion init` creates in
 * ~/.claudepanion/node_modules/.
 *
 * Adding to this surface is a public API change — bump the contractVersion in
 * companions/build/manifest.ts if you break or rename something.
 */

export { defineTool } from "../shared/define-tool.js";
export {
  successResult,
  configErrorResult,
} from "../shared/types.js";
export type {
  BaseArtifact,
  Entity,
  EntityStatus,
  Manifest,
  CompanionKind,
  CompanionToolDefinition,
  LogEntry,
} from "../shared/types.js";
```

- [ ] **Step 3: Run `npx tsc -p tsconfig.json --noEmit`** to confirm.

Expected: clean compile.

- [ ] **Step 4: Commit**

```bash
git add src/host/index.ts
git commit -m "feat(host): add src/host/index.ts as the public claudepanion-host surface"
```

### Task 4: Add `tsconfig.base.json` for user-local extends

**Files:**
- Create: `src/host/tsconfig.base.json`

- [ ] **Step 1: Write a minimal base config** the user-local install can extend:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "declaration": false,
    "sourceMap": false,
    "resolveJsonModule": true
  }
}
```

This intentionally omits `outDir`, `rootDir`, `include`, `exclude` — those are user-local concerns the home's tsconfig sets.

- [ ] **Step 2: Commit**

```bash
git add src/host/tsconfig.base.json
git commit -m "feat(host): export tsconfig.base.json for user-local extends"
```

### Task 5: Wire `claudepanion-host` exports into `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Read the current `package.json`** to capture surrounding fields.

- [ ] **Step 2: Add the `exports` map and `main`** under the top-level (alphabetize as needed):

```json
"main": "./dist/src/host/index.js",
"types": "./dist/src/host/index.d.ts",
"exports": {
  ".": {
    "import": "./dist/src/host/index.js",
    "types": "./dist/src/host/index.d.ts"
  },
  "./tsconfig.base.json": "./src/host/tsconfig.base.json"
}
```

The symlink `~/.claudepanion/node_modules/claudepanion-host -> <global-pkg-root>/` resolves `import { defineTool } from "claudepanion-host"` against this exports map. User tsconfig extends via `"extends": "claudepanion-host/tsconfig.base.json"`.

- [ ] **Step 3: Add `"declaration": true` to `tsconfig.json` compilerOptions** so that `dist/src/host/index.d.ts` actually gets generated. Verify other build paths still work.

Run: `npm run build`
Expected: `dist/src/host/index.d.ts` exists and contains the type re-exports.

- [ ] **Step 4: Commit**

```bash
git add package.json tsconfig.json
git commit -m "feat(pkg): export claudepanion-host public API + tsconfig.base.json"
```

### Task 6: Migrate the Build companion's imports to use `claudepanion-host`

**Files:**
- Modify: `companions/build/server/tools.ts`
- Modify: `companions/build/types.ts`
- Modify: `companions/build/manifest.ts` (if it imports shared types)

- [ ] **Step 1: Grep for relative `src/shared/` imports inside `companions/build/`.**

Run: `grep -rn "src/shared\|\\.\\./shared" companions/build/`
Expected: a list of files importing types/helpers via relative paths.

- [ ] **Step 2: Replace each relative shared-types import** with `import ... from "claudepanion-host";` (or `import type ... from "claudepanion-host";`).

Example transformation (in `companions/build/types.ts`):

Before:
```ts
import type { BaseArtifact } from "../../src/shared/types.js";
```

After:
```ts
import type { BaseArtifact } from "claudepanion-host";
```

- [ ] **Step 3: Add a dev-only path-alias to `tsconfig.json`** so `claudepanion-host` resolves to `src/host/index.ts` during in-framework-repo builds:

```json
"paths": {
  "claudepanion-host": ["./src/host/index.ts"],
  "claudepanion-host/tsconfig.base.json": ["./src/host/tsconfig.base.json"]
}
```

Without this, `tsc` and `vitest` running in the framework repo can't resolve the import because there's no node_modules entry yet.

- [ ] **Step 4: Run the full test suite + build.**

Run: `npm run build && npm test`
Expected: all 182 tests pass; build emits dist cleanly.

- [ ] **Step 5: Commit**

```bash
git add companions/build/ tsconfig.json
git commit -m "refactor(build): import from claudepanion-host instead of relative ../shared paths"
```

---

## Phase 3 — paths helpers

### Task 7: Add `companionsPath`, `skillsPath`, `distPath` to `src/server/paths.ts`

**Files:**
- Modify: `src/server/paths.ts`

- [ ] **Step 1: Add helpers to `paths.ts`** below the existing `rootPath / dataPath / cachePath`:

```ts
export function companionsPath(): string {
  return join(rootPath(), "companions");
}

export function skillsPath(): string {
  return join(rootPath(), "skills");
}

export function distPath(): string {
  return join(rootPath(), "dist");
}

export function nodeModulesPath(): string {
  return join(rootPath(), "node_modules");
}
```

- [ ] **Step 2: Update `ensureClaudepanionDirs()`** to create the new directories too:

```ts
export function ensureClaudepanionDirs(): void {
  mkdirSync(dataPath(), { recursive: true });
  mkdirSync(cachePath(), { recursive: true });
  mkdirSync(companionsPath(), { recursive: true });
  mkdirSync(skillsPath(), { recursive: true });
  mkdirSync(distPath(), { recursive: true });
  mkdirSync(nodeModulesPath(), { recursive: true });
}
```

- [ ] **Step 3: Run test suite.**

Run: `npm test`
Expected: all 182 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/server/paths.ts
git commit -m "feat(paths): add companionsPath/skillsPath/distPath/nodeModulesPath helpers"
```

---

## Phase 4 — `runInit` (the new core logic)

### Task 8: `runInit` test — fresh empty dir creates layout

**Files:**
- Create: `tests/cli/init.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, lstatSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../../src/cli/init";

let home: string;
const frameworkRoot = join(__dirname, "../../"); // points at the repo root for tests

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "claudepanion-init-"));
});

afterEach(() => {
  try { rmSync(home, { recursive: true, force: true }); } catch {}
});

describe("runInit — fresh install", () => {
  it("creates package.json with name 'claudepanion-home'", async () => {
    const result = await runInit({ home, frameworkRoot });
    expect(result.ok).toBe(true);
    const pkg = JSON.parse(readFileSync(join(home, "package.json"), "utf-8"));
    expect(pkg.name).toBe("claudepanion-home");
    expect(pkg.dependencies).toEqual({});
  });

  it("creates .gitignore with sensible defaults", async () => {
    await runInit({ home, frameworkRoot });
    const gi = readFileSync(join(home, ".gitignore"), "utf-8");
    expect(gi).toContain("node_modules/");
    expect(gi).toContain("data/");
    expect(gi).toContain("cache/");
    expect(gi).toContain("dist/");
  });

  it("creates data/, cache/, dist/ as real dirs", async () => {
    await runInit({ home, frameworkRoot });
    for (const sub of ["data", "cache", "dist"]) {
      expect(existsSync(join(home, sub))).toBe(true);
      expect(lstatSync(join(home, sub)).isDirectory()).toBe(true);
    }
  });

  it("creates companions/build, skills/build-companion, node_modules/claudepanion-host as symlinks", async () => {
    await runInit({ home, frameworkRoot });
    for (const sub of ["companions/build", "skills/build-companion", "node_modules/claudepanion-host"]) {
      const p = join(home, sub);
      expect(existsSync(p)).toBe(true);
      expect(lstatSync(p).isSymbolicLink()).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run tests/cli/init.test.ts`
Expected: FAIL with "Cannot find module '../../src/cli/init'" or similar.

- [ ] **Step 3: Do not commit yet — implementation follows in Task 9.**

### Task 9: Implement `runInit` — minimal pass

**Files:**
- Create: `src/cli/init.ts`

- [ ] **Step 1: Write the implementation.**

```ts
import { existsSync, mkdirSync, symlinkSync, writeFileSync, readFileSync, lstatSync } from "node:fs";
import { join } from "node:path";

export interface RunInitOptions {
  home: string;
  frameworkRoot: string;
  force?: boolean;
}

export interface RunInitResult {
  ok: true;
  symlinks: { path: string; target: string }[];
  filesCreated: string[];
}

export interface RunInitError {
  ok: false;
  stage: "validate" | "files" | "symlinks";
  error: string;
}

const HOME_PKG_NAME = "claudepanion-home";

const SYMLINKS: Array<{ rel: string; target: (frameworkRoot: string) => string }> = [
  { rel: "companions/build", target: (fr) => join(fr, "companions/build") },
  { rel: "skills/build-companion", target: (fr) => join(fr, "skills/build-companion") },
  { rel: "node_modules/claudepanion-host", target: (fr) => fr },
];

const REAL_DIRS = ["data", "cache", "dist", "companions", "skills", "node_modules"];

const DEFAULT_PACKAGE_JSON = {
  name: HOME_PKG_NAME,
  private: true,
  type: "module",
  dependencies: {},
};

const DEFAULT_GITIGNORE = [
  "node_modules/",
  "data/",
  "cache/",
  "dist/",
  ".env",
  ".env.*",
  "",
].join("\n");

export async function runInit(opts: RunInitOptions): Promise<RunInitResult | RunInitError> {
  // Validate: refuse to clobber non-claudepanion content.
  const pkgPath = join(opts.home, "package.json");
  const homeExists = existsSync(opts.home);
  if (homeExists && existsSync(pkgPath) && !opts.force) {
    try {
      const existing = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (existing.name !== HOME_PKG_NAME) {
        return { ok: false, stage: "validate", error: `${opts.home}/package.json exists but is not a claudepanion home (name="${existing.name}"). Run with --force to override.` };
      }
    } catch (err) {
      return { ok: false, stage: "validate", error: `failed to parse existing package.json: ${(err as Error).message}` };
    }
  }

  // Create real dirs + files.
  mkdirSync(opts.home, { recursive: true });
  const filesCreated: string[] = [];
  for (const dir of REAL_DIRS) {
    mkdirSync(join(opts.home, dir), { recursive: true });
  }
  if (!existsSync(pkgPath) || opts.force) {
    writeFileSync(pkgPath, JSON.stringify(DEFAULT_PACKAGE_JSON, null, 2) + "\n");
    filesCreated.push("package.json");
  }
  const giPath = join(opts.home, ".gitignore");
  if (!existsSync(giPath) || opts.force) {
    writeFileSync(giPath, DEFAULT_GITIGNORE);
    filesCreated.push(".gitignore");
  }

  // Create / refresh symlinks idempotently.
  const symlinks: { path: string; target: string }[] = [];
  for (const { rel, target } of SYMLINKS) {
    const linkPath = join(opts.home, rel);
    const targetPath = target(opts.frameworkRoot);
    // Remove existing entry if it's a symlink (refresh) or a stale broken link.
    try {
      const stat = lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        // Will be refreshed below.
        const { unlinkSync } = await import("node:fs");
        unlinkSync(linkPath);
      } else if (stat.isDirectory() || stat.isFile()) {
        return { ok: false, stage: "symlinks", error: `${linkPath} exists as a real file/dir; refusing to replace with symlink` };
      }
    } catch {
      // doesn't exist; fine.
    }
    mkdirSync(join(linkPath, ".."), { recursive: true });
    symlinkSync(targetPath, linkPath);
    symlinks.push({ path: linkPath, target: targetPath });
  }

  return { ok: true, symlinks, filesCreated };
}
```

- [ ] **Step 2: Run the tests.**

Run: `npx vitest run tests/cli/init.test.ts`
Expected: all 4 tests in "runInit — fresh install" pass.

- [ ] **Step 3: Commit**

```bash
git add src/cli/init.ts tests/cli/init.test.ts
git commit -m "feat(cli): add runInit — creates user-local layout + framework symlinks"
```

### Task 10: `runInit` — idempotency (re-running refreshes symlinks)

**Files:**
- Modify: `tests/cli/init.test.ts`

- [ ] **Step 1: Add the failing test.**

```ts
describe("runInit — idempotent", () => {
  it("running twice does not error and refreshes symlinks", async () => {
    await runInit({ home, frameworkRoot });
    const result2 = await runInit({ home, frameworkRoot });
    expect(result2.ok).toBe(true);
    expect(existsSync(join(home, "companions/build"))).toBe(true);
    expect(lstatSync(join(home, "companions/build")).isSymbolicLink()).toBe(true);
  });

  it("preserves user content during refresh", async () => {
    await runInit({ home, frameworkRoot });
    // Simulate a user-authored companion.
    const userDir = join(home, "companions/my-companion");
    mkdirSync(userDir, { recursive: true });
    writeFileSync(join(userDir, "manifest.ts"), "// user-authored");
    // Re-init.
    await runInit({ home, frameworkRoot });
    expect(existsSync(join(userDir, "manifest.ts"))).toBe(true);
    expect(readFileSync(join(userDir, "manifest.ts"), "utf-8")).toBe("// user-authored");
  });
});
```

- [ ] **Step 2: Run the tests.**

Run: `npx vitest run tests/cli/init.test.ts`
Expected: both pass already — `runInit` is already idempotent from Task 9. If a test fails, add the missing `if (!opts.force)` guard or symlink-refresh logic and re-run.

- [ ] **Step 3: Commit**

```bash
git add tests/cli/init.test.ts
git commit -m "test(cli): runInit is idempotent + preserves user-authored companions"
```

### Task 11: `runInit` — refuses to clobber non-claudepanion dirs

**Files:**
- Modify: `tests/cli/init.test.ts`

- [ ] **Step 1: Add the failing test.**

```ts
describe("runInit — clobber refusal", () => {
  it("returns error if existing package.json has a non-claudepanion-home name", async () => {
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, "package.json"), JSON.stringify({ name: "my-other-thing" }, null, 2));
    const result = await runInit({ home, frameworkRoot });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe("validate");
      expect(result.error).toMatch(/not a claudepanion home/i);
    }
  });

  it("--force overrides clobber refusal", async () => {
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, "package.json"), JSON.stringify({ name: "my-other-thing" }, null, 2));
    const result = await runInit({ home, frameworkRoot, force: true });
    expect(result.ok).toBe(true);
    const pkg = JSON.parse(readFileSync(join(home, "package.json"), "utf-8"));
    expect(pkg.name).toBe("claudepanion-home");
  });
});
```

- [ ] **Step 2: Run the tests.**

Run: `npx vitest run tests/cli/init.test.ts`
Expected: both pass — logic already in Task 9. If not, fix the validation branch.

- [ ] **Step 3: Commit**

```bash
git add tests/cli/init.test.ts
git commit -m "test(cli): runInit refuses to clobber non-claudepanion dirs; --force overrides"
```

### Task 12: `runInit` — writes tsconfig.json that extends framework's base

**Files:**
- Modify: `src/cli/init.ts`
- Modify: `tests/cli/init.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
it("creates tsconfig.json extending claudepanion-host/tsconfig.base.json", async () => {
  await runInit({ home, frameworkRoot });
  const ts = JSON.parse(readFileSync(join(home, "tsconfig.json"), "utf-8"));
  expect(ts.extends).toBe("claudepanion-host/tsconfig.base.json");
  expect(ts.compilerOptions.outDir).toBe("dist");
  expect(ts.include).toContain("companions/**/*.ts");
});
```

- [ ] **Step 2: Run the test to verify failure.**

Run: `npx vitest run tests/cli/init.test.ts -t tsconfig`
Expected: FAIL — tsconfig.json doesn't exist.

- [ ] **Step 3: Update `src/cli/init.ts`** — add the tsconfig template constant near the top of the file, alongside `DEFAULT_GITIGNORE`:

```ts
const DEFAULT_TSCONFIG = {
  extends: "claudepanion-host/tsconfig.base.json",
  compilerOptions: {
    outDir: "dist",
    rootDir: ".",
  },
  include: ["companions/**/*.ts"],
  exclude: ["node_modules", "dist"],
};
```

…and inside `runInit`, after the `.gitignore` block, write it:

```ts
const tsPath = join(opts.home, "tsconfig.json");
if (!existsSync(tsPath) || opts.force) {
  writeFileSync(tsPath, JSON.stringify(DEFAULT_TSCONFIG, null, 2) + "\n");
  filesCreated.push("tsconfig.json");
}
```

- [ ] **Step 4: Run the test.**

Run: `npx vitest run tests/cli/init.test.ts -t tsconfig`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/init.ts tests/cli/init.test.ts
git commit -m "feat(cli): runInit creates tsconfig.json extending claudepanion-host base"
```

### Task 13: `runInit` — runs initial codegen + build to seed dist/

**Files:**
- Modify: `src/cli/init.ts`
- Modify: `tests/cli/init.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
it("after init, dist/companions/index.js exists and exports an array with build", async () => {
  await runInit({ home, frameworkRoot });
  const distIndex = join(home, "dist/companions/index.js");
  expect(existsSync(distIndex)).toBe(true);
  // Load it and verify Build is registered.
  const mod = await import(distIndex);
  expect(Array.isArray(mod.companions)).toBe(true);
  expect(mod.companions.map((c: any) => c.manifest.name)).toContain("build");
});
```

- [ ] **Step 2: Run the test to verify failure.**

Run: `npx vitest run tests/cli/init.test.ts -t "dist/companions"`
Expected: FAIL — dist isn't built yet.

- [ ] **Step 3: Update `src/cli/init.ts`** to call `runRegenerate` + a tsc-equivalent compile step after creating the layout. Add to the end of `runInit`, before the return:

```ts
// Generate companions/index.ts + client.ts from disk state.
const { runRegenerate } = await import("./regenerate.js");
const regenResult = await runRegenerate({ cwd: opts.home });
if (!regenResult.ok) {
  return { ok: false, stage: "files", error: `regenerate failed: ${regenResult.error}` };
}

// Compile the freshly-written index.ts to dist/companions/index.js.
// We shell out to tsc rather than reimplementing — guarantees the user-local
// tsconfig is honored.
const { spawn } = await import("node:child_process");
const tscResult = await new Promise<{ code: number; stderr: string }>((resolve) => {
  const tscPath = join(opts.frameworkRoot, "node_modules/.bin/tsc");
  const tsc = spawn(tscPath, ["-p", opts.home], { cwd: opts.home });
  let stderr = "";
  tsc.stderr.on("data", (d) => { stderr += d.toString(); });
  tsc.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  tsc.on("error", (err) => resolve({ code: 1, stderr: err.message }));
});
if (tscResult.code !== 0) {
  return { ok: false, stage: "files", error: `tsc failed: ${tscResult.stderr.slice(0, 500)}` };
}
```

The tsc shell-out uses the framework's bundled tsc binary so the user doesn't have to install typescript globally. (`runScaffold` already follows this pattern in `src/cli/scaffold.ts` — keep consistency.)

- [ ] **Step 4: Run the test.**

Run: `npx vitest run tests/cli/init.test.ts -t "dist/companions"`
Expected: PASS.

- [ ] **Step 5: Run the full init test suite.**

Run: `npx vitest run tests/cli/init.test.ts`
Expected: all tests in `init.test.ts` pass.

- [ ] **Step 6: Commit**

```bash
git add src/cli/init.ts tests/cli/init.test.ts
git commit -m "feat(cli): runInit regenerates registry + compiles dist/ as part of bootstrap"
```

---

## Phase 5 — Wire `init` + new cwd model into `bin/cli.js`

### Task 14: Add `claudepanion init` command to the CLI

**Files:**
- Modify: `bin/cli.js`

- [ ] **Step 1: Update the USAGE string** to include `init`:

```js
const USAGE = `claudepanion — localhost companion host for Claude Code

Usage:
  claudepanion init [--force]            initialize ~/.claudepanion/ (idempotent)
  claudepanion serve                     start the server (auto-initializes if needed)
  claudepanion plugin install [--repo]   register as a Claude Code plugin
  claudepanion plugin uninstall [--repo] unregister the plugin
  claudepanion companion delete <slug>   delete a scaffolded companion
  claudepanion scaffold <slug>           generate registry files, build, remount
  claudepanion regenerate                re-derive registry files from companions/
  claudepanion remount <slug>            ask the running server to re-import a companion
  claudepanion --help                    show this help
...
`;
```

- [ ] **Step 2: Add the `init` command handler.** Add a new branch in the command dispatcher near the existing `scaffold`/`regenerate` branches:

```js
} else if (cmd === "init") {
  const force = process.argv.includes("--force");
  (async () => {
    const { runInit } = await import(join(pkgRoot, "dist/src/cli/init.js"));
    const { rootPath } = await import(join(pkgRoot, "dist/src/server/paths.js"));
    const home = rootPath();
    const result = await runInit({ home, frameworkRoot: pkgRoot, force });
    if (!result.ok) {
      console.error(`✗ init failed at ${result.stage}: ${result.error}`);
      process.exit(1);
    }
    console.log(`✓ ~/.claudepanion/ initialized`);
    for (const file of result.filesCreated) console.log(`  created  ${file}`);
    for (const link of result.symlinks) console.log(`  linked   ${link.path.replace(home + "/", "")} → ${link.target}`);
    console.log(`\nTip: run 'claudepanion plugin install' to expose this to Claude Code.`);
  })();
}
```

- [ ] **Step 3: Smoke-test the new command** with a temp home dir.

```bash
npm run build
CLAUDEPANION_HOME_OVERRIDE=/tmp/cp-test-home node bin/cli.js init
ls -la /tmp/cp-test-home
```
Expected: directory listing showing the user-local layout (package.json, companions/build → symlink, etc.).

```bash
rm -rf /tmp/cp-test-home
```

- [ ] **Step 4: Commit**

```bash
git add bin/cli.js
git commit -m "feat(cli): add 'claudepanion init' command"
```

### Task 15: `serve` auto-runs `init` when `~/.claudepanion/` is missing

**Files:**
- Modify: `bin/cli.js`

- [ ] **Step 1: Update the `serve` function** to check for the user-local home and run init if missing, then spawn the server with `cwd: home`:

```js
async function serve() {
  const { rootPath } = await import(join(pkgRoot, "dist/src/server/paths.js"));
  const home = rootPath();

  if (!existsSync(join(home, "package.json"))) {
    console.log(`~/.claudepanion/ not found.`);
    // Interactive prompt unless --yes or non-TTY.
    if (process.stdin.isTTY && !process.argv.includes("--yes")) {
      const ok = await prompt(`Initialize a new claudepanion home? [Y/n] `);
      if (ok.trim().toLowerCase() === "n") {
        die("Aborted. Run 'claudepanion init' when ready.");
      }
    }
    const { runInit } = await import(join(pkgRoot, "dist/src/cli/init.js"));
    const result = await runInit({ home, frameworkRoot: pkgRoot });
    if (!result.ok) die(`init failed at ${result.stage}: ${result.error}`);
    console.log(`✓ ~/.claudepanion/ initialized`);
  }

  const entry = join(pkgRoot, "dist/src/server/index.js");
  if (!existsSync(entry)) {
    die(`Framework build not found at ${entry}.\nReinstall: npm install -g claudepanion`);
  }
  const proc = spawn(process.execPath, [entry], {
    stdio: "inherit",
    cwd: home,
    env: process.env,
  });
  proc.on("exit", (code) => process.exit(code ?? 0));
}

async function prompt(q) {
  process.stdout.write(q);
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.resume();
    stdin.once("data", (d) => { stdin.pause(); resolve(d.toString()); });
  });
}
```

Two notable changes:
- `cwd: home` so the server runs with the user-local directory as process.cwd().
- Auto-init covers the first-run path.

- [ ] **Step 2: Smoke-test with a fresh temp home.**

```bash
rm -rf /tmp/cp-test-home
CLAUDEPANION_HOME_OVERRIDE=/tmp/cp-test-home node bin/cli.js serve --yes &
sleep 5
curl -s http://localhost:3001/api/companions | head -c 200
kill %1
rm -rf /tmp/cp-test-home
```
Expected: server starts, returns Build manifest. Confirms first-run flow end-to-end.

- [ ] **Step 3: Commit**

```bash
git add bin/cli.js
git commit -m "feat(cli): serve auto-initializes ~/.claudepanion/ on first run; spawns server with home as cwd"
```

### Task 16: Server uses dynamic-import for companions instead of static

**Files:**
- Modify: `src/server/index.ts`

- [ ] **Step 1: Replace the static import** with a dynamic import that respects `process.cwd()`:

```ts
import { bootServer } from "./boot.js";
import { join } from "node:path";

(async () => {
  const distCompanionsPath = join(process.cwd(), "dist/companions/index.js");
  const mod = await import(distCompanionsPath);
  await bootServer({ companions: mod.companions });
})();
```

This means: when running from the framework repo (`npm run dev`), cwd is the framework root, dynamic import resolves to `<repo>/dist/companions/index.js`. When running from `~/.claudepanion/` (via the CLI), cwd is the home, dynamic import resolves there. Single code path, dual behavior.

- [ ] **Step 2: Run the test suite.**

Run: `npm test`
Expected: 182 tests pass.

- [ ] **Step 3: Smoke-test from the framework repo (dev mode unchanged).**

```bash
npm run build
PORT=3098 node dist/src/server/index.js &
sleep 2
curl -s http://localhost:3098/api/companions | head -c 200
kill %1
```
Expected: Build manifest returned.

- [ ] **Step 4: Commit**

```bash
git add src/server/index.ts
git commit -m "refactor(server): load companions via cwd-relative dynamic import"
```

### Task 17: Reroute scaffold / regenerate / companion-delete to user-local cwd

**Files:**
- Modify: `bin/cli.js`

- [ ] **Step 1: Update the CLI handlers** for the three commands. Each currently passes `pkgRoot` (or relies on it) as cwd; switch to `home`.

For `scaffold`:

```js
} else if (cmd === "scaffold") {
  const slug = process.argv[3];
  if (!slug) die("Usage: claudepanion scaffold <slug>");
  (async () => {
    const { runScaffold } = await import(join(pkgRoot, "dist/src/cli/scaffold.js"));
    const { rootPath } = await import(join(pkgRoot, "dist/src/server/paths.js"));
    const result = await runScaffold(slug, { cwd: rootPath() });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  })();
```

For `regenerate`:

```js
} else if (cmd === "regenerate") {
  (async () => {
    const { runRegenerate } = await import(join(pkgRoot, "dist/src/cli/regenerate.js"));
    const { rootPath } = await import(join(pkgRoot, "dist/src/server/paths.js"));
    const result = await runRegenerate({ cwd: rootPath() });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  })();
```

For `companion delete`:

```js
} else if (cmd === "companion" && sub === "delete") {
  const slug = process.argv[4];
  if (!slug) die(`usage: claudepanion companion delete <slug>\n\n${USAGE}`);
  await companionDelete(slug);
```

…and update `companionDelete(slug)` to compute paths from `rootPath()` (the user-local home) rather than `pkgRoot`. Replace every `pkgRoot` reference inside `companionDelete` with `home`, where `home` is loaded at the top of the function via:

```js
const { rootPath } = await import(join(pkgRoot, "dist/src/server/paths.js"));
const home = rootPath();
const companionDir = join(home, "companions", slug);
const skillDir = join(home, "skills", `${slug}-companion`);
```

- [ ] **Step 2: Verify `runScaffold` already accepts a `cwd` option.**

Run: `grep -n "cwd" src/cli/scaffold.ts | head -10`
Expected: signature accepts `{ cwd: string }` opts. If not, add it as an option that defaults to `process.cwd()` and threads through to underlying calls.

- [ ] **Step 3: Smoke-test scaffold against a fresh temp home.**

```bash
rm -rf /tmp/cp-test-home
CLAUDEPANION_HOME_OVERRIDE=/tmp/cp-test-home node bin/cli.js init
CLAUDEPANION_HOME_OVERRIDE=/tmp/cp-test-home node bin/cli.js regenerate
ls /tmp/cp-test-home/companions/
```
Expected: shows `build/` (the symlink) and a regenerated `companions/index.ts`.

- [ ] **Step 4: Commit**

```bash
git add bin/cli.js
git commit -m "feat(cli): scaffold/regenerate/companion-delete operate on user-local home"
```

---

## Phase 6 — Plugin install `--repo` flag

### Task 18: Test scaffold for `--repo` and default-global

**Files:**
- Create: `tests/cli/plugin-install.test.ts`

- [ ] **Step 1: Write the failing tests.** Plugin install today calls into shared logic that we'll need to extract; for now write tests against a (yet-to-exist) `runPluginInstall` function:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPluginInstall, runPluginUninstall } from "../../src/cli/plugin-install";

let userHome: string;       // simulates $HOME
let repoRoot: string;       // simulates a git repo with a .git/

beforeEach(() => {
  userHome = mkdtempSync(join(tmpdir(), "cp-plugin-home-"));
  repoRoot = mkdtempSync(join(tmpdir(), "cp-plugin-repo-"));
  mkdirSync(join(repoRoot, ".git"));
  // Pretend ~/.claudepanion/ exists (precondition).
  mkdirSync(join(userHome, ".claudepanion"));
});

afterEach(() => {
  rmSync(userHome, { recursive: true, force: true });
  rmSync(repoRoot, { recursive: true, force: true });
});

describe("plugin install — global default", () => {
  it("writes to ~/.claude/settings.json (global)", async () => {
    const result = await runPluginInstall({ scope: "global", userHome, frameworkRoot: "/fake/framework" });
    expect(result.ok).toBe(true);
    const settingsPath = join(userHome, ".claude/settings.json");
    expect(existsSync(settingsPath)).toBe(true);
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    expect(settings.enabledPlugins["claudepanion@local"]).toBe(true);
    expect(settings.extraKnownMarketplaces.local.source.path).toBe(join(userHome, ".claudepanion"));
  });

  it("refuses when ~/.claudepanion/ does not exist", async () => {
    rmSync(join(userHome, ".claudepanion"), { recursive: true, force: true });
    const result = await runPluginInstall({ scope: "global", userHome, frameworkRoot: "/fake/framework" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/init/i);
  });
});

describe("plugin install — --repo", () => {
  it("writes to <repo>/.claude/settings.local.json", async () => {
    const result = await runPluginInstall({ scope: "repo", userHome, frameworkRoot: "/fake/framework", repoRoot });
    expect(result.ok).toBe(true);
    const settingsPath = join(repoRoot, ".claude/settings.local.json");
    expect(existsSync(settingsPath)).toBe(true);
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    expect(settings.enabledPlugins["claudepanion@local"]).toBe(true);
    expect(settings.extraKnownMarketplaces.local.source.path).toBe(join(userHome, ".claudepanion"));
  });
});

describe("plugin uninstall mirrors --repo", () => {
  it("global uninstall removes ~/.claude/settings.json entries", async () => {
    await runPluginInstall({ scope: "global", userHome, frameworkRoot: "/fake/framework" });
    const result = await runPluginUninstall({ scope: "global", userHome });
    expect(result.ok).toBe(true);
    const settings = JSON.parse(readFileSync(join(userHome, ".claude/settings.json"), "utf-8"));
    expect(settings.enabledPlugins?.["claudepanion@local"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify fail.**

Run: `npx vitest run tests/cli/plugin-install.test.ts`
Expected: FAIL — module doesn't exist.

### Task 19: Extract `runPluginInstall` and `runPluginUninstall` into `src/cli/plugin-install.ts`

**Files:**
- Create: `src/cli/plugin-install.ts`
- Modify: `bin/cli.js` (refactor to use the extracted function)

- [ ] **Step 1: Write `src/cli/plugin-install.ts`.**

```ts
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export interface PluginInstallOptions {
  scope: "global" | "repo";
  /** Defaults to os.homedir(). Override for tests. */
  userHome?: string;
  /** Required when scope === "repo". The git-root path. */
  repoRoot?: string;
  /** Framework package root — not currently used in settings.json but kept for forward compat. */
  frameworkRoot: string;
}

export type PluginInstallResult =
  | { ok: true; settingsPath: string }
  | { ok: false; error: string };

const PLUGIN_NAME = "claudepanion@local";

function userHomeOrDefault(opts: { userHome?: string }): string {
  return opts.userHome ?? process.env.HOME ?? homedir();
}

function claudepanionHome(userHome: string): string {
  return join(userHome, ".claudepanion");
}

function settingsPathFor(scope: "global" | "repo", opts: PluginInstallOptions): string {
  const userHome = userHomeOrDefault(opts);
  if (scope === "global") return join(userHome, ".claude/settings.json");
  if (!opts.repoRoot) throw new Error("repo scope requires repoRoot");
  return join(opts.repoRoot, ".claude/settings.local.json");
}

function readJson(path: string): Record<string, unknown> {
  try { return JSON.parse(readFileSync(path, "utf-8")); }
  catch { return {}; }
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

export async function runPluginInstall(opts: PluginInstallOptions): Promise<PluginInstallResult> {
  const userHome = userHomeOrDefault(opts);
  const home = claudepanionHome(userHome);
  if (!existsSync(home)) {
    return { ok: false, error: `${home} not found. Run 'claudepanion init' first.` };
  }
  const settingsPath = settingsPathFor(opts.scope, opts);
  const settings = readJson(settingsPath);

  const enabledPlugins = (settings.enabledPlugins ?? {}) as Record<string, boolean>;
  enabledPlugins[PLUGIN_NAME] = true;
  settings.enabledPlugins = enabledPlugins;

  const marketplaces = (settings.extraKnownMarketplaces ?? {}) as Record<string, unknown>;
  marketplaces.local = { source: { source: "directory", path: home } };
  settings.extraKnownMarketplaces = marketplaces;

  writeJson(settingsPath, settings);
  return { ok: true, settingsPath };
}

export async function runPluginUninstall(opts: { scope: "global" | "repo"; userHome?: string; repoRoot?: string }): Promise<PluginInstallResult> {
  const settingsPath = settingsPathFor(opts.scope, { scope: opts.scope, userHome: opts.userHome, repoRoot: opts.repoRoot, frameworkRoot: "" });
  if (!existsSync(settingsPath)) return { ok: true, settingsPath };
  const settings = readJson(settingsPath);
  const enabledPlugins = settings.enabledPlugins as Record<string, boolean> | undefined;
  if (enabledPlugins && enabledPlugins[PLUGIN_NAME] !== undefined) delete enabledPlugins[PLUGIN_NAME];
  const marketplaces = settings.extraKnownMarketplaces as Record<string, unknown> | undefined;
  if (marketplaces && marketplaces.local) delete marketplaces.local;
  writeJson(settingsPath, settings);
  return { ok: true, settingsPath };
}
```

- [ ] **Step 2: Run the tests.**

Run: `npx vitest run tests/cli/plugin-install.test.ts`
Expected: all pass.

- [ ] **Step 3: Update `bin/cli.js`** to use the new extracted function. Replace the existing `pluginInstall` / `pluginUninstall` definitions:

```js
async function pluginInstall() {
  const wantRepo = process.argv.includes("--repo");
  const { runPluginInstall } = await import(join(pkgRoot, "dist/src/cli/plugin-install.js"));
  let opts;
  if (wantRepo) {
    const gitRoot = findGitRoot();
    if (!gitRoot) die("Error: --repo requires a git repository");
    opts = { scope: "repo", repoRoot: gitRoot, frameworkRoot: pkgRoot };
  } else {
    opts = { scope: "global", frameworkRoot: pkgRoot };
  }
  const result = await runPluginInstall(opts);
  if (!result.ok) die(`✗ ${result.error}`);
  console.log(`✓  Plugin installed (${result.settingsPath})`);
  console.log(`   Marketplace source: ${join(process.env.HOME ?? require("node:os").homedir(), ".claudepanion")}`);
  console.log("\n   Start a new Claude Code session for the plugin to load.");
}

async function pluginUninstall() {
  const wantRepo = process.argv.includes("--repo");
  const { runPluginUninstall } = await import(join(pkgRoot, "dist/src/cli/plugin-install.js"));
  let opts;
  if (wantRepo) {
    const gitRoot = findGitRoot();
    if (!gitRoot) die("Error: --repo requires a git repository");
    opts = { scope: "repo", repoRoot: gitRoot };
  } else {
    opts = { scope: "global" };
  }
  const result = await runPluginUninstall(opts);
  if (!result.ok) die(`✗ ${result.error}`);
  console.log(`✓  Plugin removed (${result.settingsPath})`);
}
```

Also make sure the `plugin install` / `plugin uninstall` dispatcher branches `await` these now-async functions.

- [ ] **Step 4: Run the full test suite.**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/cli/plugin-install.ts bin/cli.js tests/cli/plugin-install.test.ts
git commit -m "feat(cli): plugin install/uninstall support --repo flag; global default"
```

---

## Phase 7 — Publish prep

### Task 20: Make the package publishable

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Edit `package.json`** to make it npm-publishable. Specific changes:

- Remove `"private": true`
- Add a `"files"` array specifying what gets shipped in the published tarball:

```json
"files": [
  "bin/",
  "dist/",
  "companions/build/",
  "skills/build-companion/",
  "src/host/tsconfig.base.json",
  "README.md",
  "LICENSE"
]
```

- Confirm `"bin"` and `"main"` are correct (set in Phase 2):

```json
"bin": { "claudepanion": "./bin/cli.js" },
"main": "./dist/src/host/index.js"
```

- [ ] **Step 2: Run `npm pack --dry-run`** to preview the tarball contents.

Run: `npm pack --dry-run 2>&1 | head -40`
Expected: lists `bin/cli.js`, `dist/`, `companions/build/`, `skills/build-companion/`, `src/host/tsconfig.base.json`, `README.md`, `LICENSE` (and nothing extraneous like tests, .git, docs).

If you see test files or docs in the output, tighten `"files"` further.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(pkg): drop private; add files array for publishable tarball"
```

### Task 21: Update README Quickstart

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the Quickstart section** (currently the `git clone` flow at lines 9-43) with the new model:

```markdown
## Quick start

Install the framework globally:

\`\`\`bash
npm install -g claudepanion
\`\`\`

Initialize your personal install (one-time, idempotent):

\`\`\`bash
claudepanion init
\`\`\`

This creates `~/.claudepanion/` — a Git-able directory holding your companions, skills, and runtime data. The framework's Build companion and `claudepanion-host` runtime are symlinked in automatically.

Register claudepanion with Claude Code:

\`\`\`bash
claudepanion plugin install          # global: loads in every Claude Code session
# or
claudepanion plugin install --repo   # per-repo: writes to <repo>/.claude/settings.local.json
\`\`\`

Start the server:

\`\`\`bash
claudepanion serve                   # http://localhost:3001
\`\`\`

Open <http://localhost:3001>. Start a **new** Claude Code session if you just installed — plugins load at session start.

### Optional: version-control your install as a dotfile

\`\`\`bash
cd ~/.claudepanion
git init
git remote add origin git@github.com:you/my-claudepanion.git
git add . && git commit -m "initial"
git push -u origin main
\`\`\`

On a new machine: `npm install -g claudepanion && git clone <your-repo> ~/.claudepanion && cd ~/.claudepanion && npm install`.

### Uninstall

\`\`\`bash
claudepanion plugin uninstall
npm uninstall -g claudepanion
# optionally: rm -rf ~/.claudepanion
\`\`\`

### Dev mode (hacking on the framework itself)

\`\`\`bash
git clone https://github.com/sean1588/claudepanion
cd claudepanion
npm install
npm link                             # registers this checkout as the global "claudepanion"
claudepanion init                    # repoints ~/.claudepanion/'s symlinks at the checkout
npm run dev                          # tsx-watch on the framework
\`\`\`
```

- [ ] **Step 2: Update the "How it works" + "Companion anatomy" sections** to reference `~/.claudepanion/companions/<slug>/` instead of `companions/<slug>/` (the framework-repo-relative path is now misleading).

- [ ] **Step 3: Smoke-read the README end-to-end** to catch other stale references to the cloned-repo flow.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: rewrite Quickstart for npm install -g + ~/.claudepanion/ flow"
```

### Task 22: Add user-local install troubleshooting

**Files:**
- Modify: `docs/troubleshooting.md`

- [ ] **Step 1: Add a new section** to `docs/troubleshooting.md`:

```markdown
## "Companion import 'claudepanion-host' not found" in a freshly scaffolded companion

The symlink at `~/.claudepanion/node_modules/claudepanion-host` is broken or missing. Most common cause: switched node versions (`nvm use` or similar) and the global path moved. Fix:

\`\`\`bash
claudepanion init
\`\`\`

Init is idempotent; running it refreshes the symlinks. If that doesn't work, verify the global install is intact: `which claudepanion && ls -la $(dirname $(dirname $(which claudepanion)))/lib/node_modules/claudepanion`.

## "`~/.claudepanion/` not found" when running `claudepanion plugin install`

`plugin install` requires the user-local home to exist (the marketplace source points there). Run `claudepanion init` first, then retry `plugin install`.

## After `npm install -g claudepanion@latest`, companions fail to load

Possible contract-version drift — the new framework supports `contractVersion: "X"` and your companions are on an older version. Open <http://localhost:3001/api/reliability/<companion>> to see the validator's complaint. As an interim workaround, edit the companion's `manifest.ts` to bump the contractVersion (if no breaking changes apply) or pin to the previous framework version (`npm install -g claudepanion@<previous>`).
```

- [ ] **Step 2: Commit**

```bash
git add docs/troubleshooting.md
git commit -m "docs(troubleshooting): add sections for user-local install issues"
```

---

## Phase 8 — Integration test + dogfood

### Task 23: End-to-end CLI integration test

**Files:**
- Create: `tests/cli/end-to-end.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = join(__dirname, "../..");

describe("CLI end-to-end (init → regenerate)", () => {
  let home: string;
  beforeAll(() => {
    home = mkdtempSync(join(tmpdir(), "cp-e2e-"));
  });
  afterAll(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it("init produces a valid user-local layout", () => {
    const result = spawnSync("node", [join(repoRoot, "bin/cli.js"), "init"], {
      env: { ...process.env, CLAUDEPANION_HOME_OVERRIDE: home },
      encoding: "utf-8",
    });
    expect(result.status).toBe(0);
    expect(existsSync(join(home, ".claudepanion/package.json"))).toBe(true);
    expect(existsSync(join(home, ".claudepanion/companions/build"))).toBe(true);
    expect(existsSync(join(home, ".claudepanion/dist/companions/index.js"))).toBe(true);
  });

  it("regenerate rewrites the registry idempotently after init", () => {
    const result = spawnSync("node", [join(repoRoot, "bin/cli.js"), "regenerate"], {
      env: { ...process.env, CLAUDEPANION_HOME_OVERRIDE: home },
      encoding: "utf-8",
    });
    const parsed = JSON.parse(result.stdout);
    expect(parsed.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Build first.**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Run the test.**

Run: `npx vitest run tests/cli/end-to-end.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/cli/end-to-end.test.ts
git commit -m "test(cli): end-to-end init + regenerate against a temp home"
```

### Task 24: Manual dogfood walkthrough

**Files:** (none — this is a verification step, not code)

- [ ] **Step 1: Set up a clean dev environment.**

```bash
# In the framework checkout:
cd ~/github/sean1588/claudepanion
npm run build
npm link                              # register this checkout as the global "claudepanion"
```

- [ ] **Step 2: Initialize a fresh user-local install.**

```bash
# Use CLAUDEPANION_HOME_OVERRIDE to avoid clobbering your real ~/.claudepanion/ during the test.
rm -rf /tmp/cp-dogfood
CLAUDEPANION_HOME_OVERRIDE=/tmp/cp-dogfood-home claudepanion init
ls -la /tmp/cp-dogfood-home/.claudepanion/
```
Expected: real package.json, .gitignore, tsconfig.json, dist/, data/, cache/; symlinks for companions/build/, skills/build-companion/, node_modules/claudepanion-host/.

- [ ] **Step 3: Install the plugin (global scope, into a sandboxed HOME).**

```bash
HOME=/tmp/cp-dogfood CLAUDEPANION_HOME_OVERRIDE=/tmp/cp-dogfood/.claudepanion claudepanion plugin install
cat /tmp/cp-dogfood/.claude/settings.json
```
Expected: enabledPlugins + extraKnownMarketplaces wired up. Marketplace source path = `/tmp/cp-dogfood/.claudepanion`.

- [ ] **Step 4: Boot the server and confirm Build loads.**

```bash
HOME=/tmp/cp-dogfood CLAUDEPANION_HOME_OVERRIDE=/tmp/cp-dogfood/.claudepanion claudepanion serve &
sleep 3
curl -s http://localhost:3001/api/companions | jq '.[].name'
kill %1
```
Expected: `"build"` in the output.

- [ ] **Step 5: Cleanup.**

```bash
rm -rf /tmp/cp-dogfood /tmp/cp-dogfood-home
# in framework checkout:
cd ~/github/sean1588/claudepanion && npm unlink
```

- [ ] **Step 6: No commit — this is a manual verification.**

If anything in steps 1-4 fails, file the gap as a follow-up before declaring Phase 8 complete.

---

## Phase 9 — Final cleanup

### Task 25: Run the full test suite and rebuild

- [ ] **Step 1: Run `npm run build && npm test`**

Expected: clean build; all tests pass (count: at minimum 182 + the ~15 new tests added in this plan = ~197).

- [ ] **Step 2: If anything fails, fix inline before declaring the plan complete.**

### Task 26: Push the branch and open a PR

- [ ] **Step 1: Push.**

```bash
git push -u origin feat/user-local-install-spec
```

(The branch already contains the spec doc; this push will include all implementation commits.)

- [ ] **Step 2: Open the PR.** Use `finishing-a-development-branch` for the full ship flow. Title suggestion: *"Option B — user-local install: ~/.claudepanion/ + global npm install"*

- [ ] **Step 3: Body should reference the spec** at `docs/superpowers/specs/2026-05-10-user-local-install-design.md` and list:
  - Server refactored into bootable function (no more static companions import)
  - `claudepanion-host` public API + tsconfig.base.json
  - `claudepanion init` command — bootstraps `~/.claudepanion/`
  - Plugin install `--repo` flag; global default
  - Scaffold/regenerate/companion-delete reroute to user-local
  - README + troubleshooting rewritten for the new flow
  - Package is publishable (`private: true` dropped, files array added)
  - ~15 new tests, full suite still green

---

## Out of scope (do NOT add to this plan)

- `claudepanion migrate-from-clone` for hypothetical users with pre-Option-B personal companions
- `claudepanion migrate-companion` for contract-version drift
- `claudepanion doctor`
- Named profiles (`~/.claudepanion/profiles/<name>/`)
- Companion Hub / npm-style registry UX
- Windows symlink handling
- Actually publishing to npm (a follow-up; v1 of Option B ships the *capability* to be installed globally, not the registry presence)
