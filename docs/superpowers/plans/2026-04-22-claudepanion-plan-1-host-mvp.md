# Claudepanion — Plan 1: Host MVP + Reference Companion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working claudepanion host (Express + MCP + React+Vite SPA) with one hand-written reference entity companion (`expense-tracker`), demonstrating all four entity states end-to-end with polling-based log updates.

**Architecture:** Single Node process. Express serves the static React build + a REST API under `/api` + an MCP server under `/mcp`. Companions are filesystem-convention modules imported through a generated `companions/index.ts`. No watcher yet — restart required to pick up new companions (Plan 2 adds hot re-mount). Entities stored as one JSON file per entity under `data/<companion>/`. The client polls `GET /api/entities/:id` every 2s while an entity is active.

**Tech Stack:** Node 20, TypeScript 5, Express 4, `@modelcontextprotocol/sdk` (Streamable HTTP transport), React 18, Vite 6, react-router-dom v6, Vitest + @testing-library/react, tsx for dev server.

**Spec reference:** `docs/superpowers/specs/2026-04-22-claudepanion-ux-redesign-design.md`

**Out of scope for Plan 1** (Plans 2–6): soft re-mount watcher, contract validator, smoke test, Build companion, tool-kind companions, auto-About page, iteration mode, `/install` page, "Iterate with Build" button.

---

## File structure for Plan 1

```
claude-manager/
├─ package.json                       # updated with react/vite/testing-library deps
├─ tsconfig.json                      # server-side TS config
├─ tsconfig.client.json               # client-side TS config (JSX, DOM libs)
├─ vite.config.ts                     # Vite config with proxy to Express
├─ vitest.config.ts                   # test config (covers both server + client)
├─ index.html                         # Vite entry
├─ .mcp.json                          # keep localhost:3000/mcp pointer
├─ .gitignore                         # extended
├─ src/
│  ├─ shared/
│  │  └─ types.ts                     # Entity, EntityStatus, LogEntry, Manifest, CompanionKind
│  ├─ server/
│  │  ├─ index.ts                     # Express bootstrap + static serve
│  │  ├─ entity-store.ts              # per-entity JSON I/O (atomic)
│  │  ├─ companion-registry.ts        # loads companions/index.ts, exposes lookups
│  │  ├─ api-routes.ts                # /api/entities/*, /api/companions
│  │  ├─ id.ts                        # entity id generator
│  │  └─ mcp.ts                       # MCP server + auto-registered generic tools
│  └─ client/
│     ├─ main.tsx                     # Vite entry
│     ├─ App.tsx                      # router + shell
│     ├─ styles.css
│     ├─ api.ts                       # typed fetch wrappers
│     ├─ components/
│     │  ├─ Sidebar.tsx
│     │  ├─ StatusPill.tsx
│     │  ├─ SlashCommandBlock.tsx
│     │  ├─ LogsPanel.tsx
│     │  ├─ StatusBar.tsx             # amber "current step" bar
│     │  ├─ ContinuationForm.tsx
│     │  └─ StaleBadge.tsx
│     ├─ hooks/
│     │  ├─ useEntity.ts              # 2s polling
│     │  └─ useCompanions.ts
│     └─ pages/
│        ├─ EntityList.tsx            # host frame + companion-provided row renderer
│        ├─ NewEntity.tsx             # host frame + companion-provided form
│        └─ EntityDetail.tsx          # host frame + 4 state morphs
├─ companions/
│  ├─ index.ts                        # re-exports expense-tracker
│  └─ expense-tracker/
│     ├─ manifest.ts
│     ├─ index.ts
│     ├─ types.ts
│     ├─ form.tsx
│     ├─ pages/
│     │  ├─ List.tsx                  # row renderer + column defs
│     │  └─ Detail.tsx                # artifact body component
│     └─ server/
│        └─ tools.ts                  # empty (no domain tools for Plan 1)
├─ skills/
│  └─ expense-tracker-companion.md    # the slash-command playbook
├─ data/
│  └─ .gitkeep
└─ tests/
   ├─ server/
   │  ├─ entity-store.test.ts
   │  ├─ companion-registry.test.ts
   │  ├─ api-routes.test.ts
   │  └─ mcp.test.ts
   └─ client/
      ├─ StatusPill.test.tsx
      ├─ SlashCommandBlock.test.tsx
      ├─ LogsPanel.test.tsx
      └─ EntityDetail.test.tsx
```

---

## Task 0: Clean slate — remove prior host code

**Files:**
- Delete: `src/` (entire old tree: `broadcast.ts`, `companions.ts`, `mcp.ts`, `server.ts`, `storage.ts`, `types.ts`, `helpers/`, `ui/`)
- Delete: `companions/build/` (Plan 3 recreates it)
- Delete: `skills/build/`, `skills/use-claudepanion/` (resuscitated later if needed)
- Delete: `tests/` contents (will rewrite)
- Delete: `dist/`
- Delete: `bin/` (no CLI in Plan 1; Plan 2 re-adds)
- Delete: `.DS_Store` files
- Keep: `docs/`, `.claude-plugin/`, `.mcp.json`, `LICENSE`, `README.md`, `package.json` (will rewrite), `tsconfig.json` (will rewrite), `vitest.config.ts` (will rewrite), `.gitignore`, `data/`, `.git/`, `node_modules/`

- [ ] **Step 1: Verify the working tree is clean before deleting**

Run: `git status`
Expected: `nothing to commit, working tree clean` on branch `design/claudepanion-ux-redesign`

- [ ] **Step 2: Delete old source trees**

```bash
rm -rf src companions/build skills/build skills/use-claudepanion tests dist bin
find . -name .DS_Store -delete
```

- [ ] **Step 3: Verify deletions**

Run: `ls src companions skills tests 2>&1 || true`
Expected: `ls: cannot access 'src': No such file or directory` and similar for tests, dist, bin. `companions/` and `skills/` exist but are empty.

- [ ] **Step 4: Commit the clean slate**

```bash
git add -A
git commit -m "plan-1: clean slate for host rebuild

Remove the template-string host and prior scaffolding. Plan 1 rebuilds
everything under a new src/ tree with server/client/shared split."
```

---

## Task 1: Project config (package.json, tsconfig, vite, vitest)

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.client.json`
- Create: `vite.config.ts`
- Modify: `vitest.config.ts`
- Create: `index.html`
- Modify: `.gitignore`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "claudepanion",
  "version": "0.2.0",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently -n server,client -c blue,green \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "tsx watch src/server/index.ts",
    "dev:client": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "start": "node dist/server/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.client.json --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "express": "^4.19.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/express": "^5.0.1",
    "@types/node": "^22.19.17",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@types/supertest": "^6.0.2",
    "@vitejs/plugin-react": "^4.3.1",
    "concurrently": "^9.0.1",
    "jsdom": "^25.0.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vite": "^6.0.0",
    "vitest": "^4.1.4"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json` (server config)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/server/**/*", "src/shared/**/*", "companions/**/*.ts"],
  "exclude": ["node_modules", "dist", "src/client", "companions/**/*.tsx"]
}
```

- [ ] **Step 3: Write `tsconfig.client.json` (client config)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/client/**/*", "src/shared/**/*", "companions/**/*.tsx", "companions/**/*.ts"],
  "exclude": ["node_modules", "dist", "src/server"]
}
```

- [ ] **Step 4: Write `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  root: ".",
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/mcp": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
});
```

- [ ] **Step 5: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 6: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>claudepanion</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Extend `.gitignore`**

Current `.gitignore` already contains `node_modules`, `dist`, `.DS_Store`, `.superpowers/`, and `data/*` rules. Verify these are present; if any are missing, add them. Final content should be:

```
node_modules
dist
.DS_Store
.superpowers/

# runtime data — contents gitignored, directory kept via .gitkeep
data/*
!data/.gitkeep
```

- [ ] **Step 8: Install deps and verify tsc runs**

Run: `npm install && npm run check`
Expected: installs complete; `tsc --noEmit` for both configs exits 0 with no files to compile (src/ is still empty).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.client.json vite.config.ts vitest.config.ts index.html .gitignore
git commit -m "plan-1: project config (react+vite+express+vitest)"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/shared/types.ts`
- Create: `tests/setup.ts` (testing-library jest-dom matchers)
- Test: `tests/shared/types.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/shared/types.test.ts
import { describe, it, expectTypeOf } from "vitest";
import type { Entity, EntityStatus, LogEntry, Manifest, CompanionKind } from "@shared/types";

describe("shared types", () => {
  it("Entity is parameterized by Input and Artifact", () => {
    type I = { amount: number };
    type A = { tag: string };
    expectTypeOf<Entity<I, A>["input"]>().toEqualTypeOf<I>();
    expectTypeOf<Entity<I, A>["artifact"]>().toEqualTypeOf<A | null>();
  });

  it("EntityStatus is the 4-state union", () => {
    expectTypeOf<EntityStatus>().toEqualTypeOf<"pending" | "running" | "completed" | "error">();
  });

  it("LogEntry has timestamp/level/message", () => {
    const e: LogEntry = { timestamp: "2026-04-22T00:00:00Z", level: "info", message: "x" };
    expectTypeOf(e.level).toEqualTypeOf<"info" | "warn" | "error">();
  });

  it("CompanionKind is entity or tool", () => {
    expectTypeOf<CompanionKind>().toEqualTypeOf<"entity" | "tool">();
  });

  it("Manifest has the declared fields", () => {
    const m: Manifest = {
      name: "x",
      kind: "entity",
      displayName: "X",
      icon: "📦",
      description: "desc",
      contractVersion: "1",
      version: "0.1.0",
    };
    expectTypeOf(m.kind).toEqualTypeOf<CompanionKind>();
  });
});
```

- [ ] **Step 2: Write `tests/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `npx vitest run tests/shared/types.test.ts`
Expected: FAIL — "Cannot find module '@shared/types'"

- [ ] **Step 4: Write `src/shared/types.ts`**

```ts
export type EntityStatus = "pending" | "running" | "completed" | "error";

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface Entity<Input = unknown, Artifact = unknown> {
  id: string;
  companion: string;
  status: EntityStatus;
  statusMessage: string | null;
  createdAt: string;
  updatedAt: string;
  input: Input;
  artifact: Artifact | null;
  errorMessage: string | null;
  errorStack: string | null;
  logs: LogEntry[];
}

export type CompanionKind = "entity" | "tool";

export interface Manifest {
  name: string;
  kind: CompanionKind;
  displayName: string;
  icon: string;
  description: string;
  contractVersion: string;
  version: string;
}
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `npx vitest run tests/shared/types.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts tests/shared/types.test.ts tests/setup.ts
git commit -m "plan-1: shared Entity/Manifest types"
```

---

## Task 3: Entity ID generator

**Files:**
- Create: `src/server/id.ts`
- Test: `tests/server/id.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/server/id.test.ts
import { describe, it, expect } from "vitest";
import { generateEntityId } from "../../src/server/id";

describe("generateEntityId", () => {
  it("prefixes with companion name and appends 6 hex chars", () => {
    const id = generateEntityId("expense-tracker");
    expect(id).toMatch(/^expense-tracker-[0-9a-f]{6}$/);
  });

  it("generates distinct ids", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateEntityId("x"));
    expect(ids.size).toBe(100);
  });
});
```

- [ ] **Step 2: Run the test, verify fail**

Run: `npx vitest run tests/server/id.test.ts`
Expected: FAIL — Cannot find module `../../src/server/id`.

- [ ] **Step 3: Write `src/server/id.ts`**

```ts
import { randomBytes } from "node:crypto";

export function generateEntityId(companion: string): string {
  const suffix = randomBytes(3).toString("hex");
  return `${companion}-${suffix}`;
}
```

- [ ] **Step 4: Run the test, verify pass**

Run: `npx vitest run tests/server/id.test.ts`
Expected: PASS 2/2.

- [ ] **Step 5: Commit**

```bash
git add src/server/id.ts tests/server/id.test.ts
git commit -m "plan-1: entity id generator"
```

---

## Task 4: Entity store

**Files:**
- Create: `src/server/entity-store.ts`
- Test: `tests/server/entity-store.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/server/entity-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEntityStore, type EntityStore } from "../../src/server/entity-store";

let store: EntityStore;
let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "claudepanion-test-"));
  store = createEntityStore(tmp);
});

describe("entity store", () => {
  it("creates an entity in pending state with empty logs", async () => {
    const e = await store.create({
      id: "x-abc",
      companion: "x",
      input: { foo: 1 },
    });
    expect(e.status).toBe("pending");
    expect(e.logs).toEqual([]);
    expect(e.artifact).toBeNull();
    expect(e.input).toEqual({ foo: 1 });
    expect(e.createdAt).toEqual(e.updatedAt);
  });

  it("round-trips an entity through get", async () => {
    await store.create({ id: "x-1", companion: "x", input: { a: 1 } });
    const got = await store.get("x", "x-1");
    expect(got?.id).toBe("x-1");
    expect(got?.input).toEqual({ a: 1 });
  });

  it("returns null for missing entity", async () => {
    expect(await store.get("x", "nope")).toBeNull();
  });

  it("lists entities for a companion", async () => {
    await store.create({ id: "x-1", companion: "x", input: {} });
    await store.create({ id: "x-2", companion: "x", input: {} });
    await store.create({ id: "y-1", companion: "y", input: {} });
    const xs = await store.list("x");
    expect(xs.map((e) => e.id).sort()).toEqual(["x-1", "x-2"]);
  });

  it("updates status and bumps updatedAt", async () => {
    await store.create({ id: "x-1", companion: "x", input: {} });
    const before = (await store.get("x", "x-1"))!.updatedAt;
    await new Promise((r) => setTimeout(r, 10));
    await store.updateStatus("x", "x-1", "running", "step 1");
    const after = await store.get("x", "x-1");
    expect(after?.status).toBe("running");
    expect(after?.statusMessage).toBe("step 1");
    expect(after!.updatedAt > before).toBe(true);
  });

  it("appends a log entry", async () => {
    await store.create({ id: "x-1", companion: "x", input: {} });
    await store.appendLog("x", "x-1", "hello", "info");
    const e = await store.get("x", "x-1");
    expect(e?.logs.length).toBe(1);
    expect(e?.logs[0].message).toBe("hello");
    expect(e?.logs[0].level).toBe("info");
  });

  it("saves artifact and flips to completed", async () => {
    await store.create({ id: "x-1", companion: "x", input: {} });
    await store.saveArtifact("x", "x-1", { result: 42 });
    const e = await store.get("x", "x-1");
    expect(e?.artifact).toEqual({ result: 42 });
    expect(e?.status).toBe("completed");
  });

  it("marks as error with message and optional stack", async () => {
    await store.create({ id: "x-1", companion: "x", input: {} });
    await store.fail("x", "x-1", "boom", "stack trace");
    const e = await store.get("x", "x-1");
    expect(e?.status).toBe("error");
    expect(e?.errorMessage).toBe("boom");
    expect(e?.errorStack).toBe("stack trace");
  });

  it("continuation flips back to pending and preserves artifact as previous", async () => {
    await store.create({ id: "x-1", companion: "x", input: { original: true } });
    await store.saveArtifact("x", "x-1", { result: "v1" });
    await store.continueWith("x", "x-1", "make it better");
    const e = await store.get("x", "x-1");
    expect(e?.status).toBe("pending");
    expect((e?.input as any).continuation).toBe("make it better");
    expect((e?.input as any).previousArtifact).toEqual({ result: "v1" });
  });

  afterEach();
});

function afterEach() {
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
}
```

- [ ] **Step 2: Run the test, verify fail**

Run: `npx vitest run tests/server/entity-store.test.ts`
Expected: FAIL — Cannot find module `../../src/server/entity-store`.

- [ ] **Step 3: Write `src/server/entity-store.ts`**

```ts
import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import type { Entity, EntityStatus } from "../shared/types.js";

export interface CreateEntityArgs {
  id: string;
  companion: string;
  input: unknown;
}

export interface EntityStore {
  create(args: CreateEntityArgs): Promise<Entity>;
  get(companion: string, id: string): Promise<Entity | null>;
  list(companion: string): Promise<Entity[]>;
  updateStatus(companion: string, id: string, status: EntityStatus, statusMessage?: string | null): Promise<void>;
  appendLog(companion: string, id: string, message: string, level?: "info" | "warn" | "error"): Promise<void>;
  saveArtifact(companion: string, id: string, artifact: unknown): Promise<void>;
  fail(companion: string, id: string, errorMessage: string, errorStack?: string): Promise<void>;
  continueWith(companion: string, id: string, continuation: string): Promise<void>;
}

export function createEntityStore(root: string): EntityStore {
  const companionDir = (c: string) => join(root, c);
  const entityPath = (c: string, id: string) => join(companionDir(c), `${id}.json`);

  async function writeAtomic(path: string, data: unknown): Promise<void> {
    await fs.mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2));
    await fs.rename(tmp, path);
  }

  async function readEntity(c: string, id: string): Promise<Entity | null> {
    try {
      const raw = await fs.readFile(entityPath(c, id), "utf8");
      return JSON.parse(raw) as Entity;
    } catch (err: any) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
  }

  async function mutate(c: string, id: string, fn: (e: Entity) => Entity): Promise<void> {
    const current = await readEntity(c, id);
    if (!current) throw new Error(`entity not found: ${c}/${id}`);
    const next = { ...fn(current), updatedAt: new Date().toISOString() };
    await writeAtomic(entityPath(c, id), next);
  }

  return {
    async create({ id, companion, input }) {
      const now = new Date().toISOString();
      const entity: Entity = {
        id,
        companion,
        status: "pending",
        statusMessage: null,
        createdAt: now,
        updatedAt: now,
        input,
        artifact: null,
        errorMessage: null,
        errorStack: null,
        logs: [],
      };
      await writeAtomic(entityPath(companion, id), entity);
      return entity;
    },

    async get(companion, id) {
      return readEntity(companion, id);
    },

    async list(companion) {
      try {
        const names = await fs.readdir(companionDir(companion));
        const files = names.filter((n) => n.endsWith(".json"));
        const entities = await Promise.all(
          files.map(async (n) => {
            const raw = await fs.readFile(join(companionDir(companion), n), "utf8");
            return JSON.parse(raw) as Entity;
          })
        );
        return entities.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      } catch (err: any) {
        if (err.code === "ENOENT") return [];
        throw err;
      }
    },

    async updateStatus(companion, id, status, statusMessage = null) {
      await mutate(companion, id, (e) => ({ ...e, status, statusMessage }));
    },

    async appendLog(companion, id, message, level = "info") {
      await mutate(companion, id, (e) => ({
        ...e,
        logs: [...e.logs, { timestamp: new Date().toISOString(), level, message }],
      }));
    },

    async saveArtifact(companion, id, artifact) {
      await mutate(companion, id, (e) => ({ ...e, artifact, status: "completed", statusMessage: null }));
    },

    async fail(companion, id, errorMessage, errorStack) {
      await mutate(companion, id, (e) => ({
        ...e,
        status: "error",
        errorMessage,
        errorStack: errorStack ?? null,
      }));
    },

    async continueWith(companion, id, continuation) {
      await mutate(companion, id, (e) => ({
        ...e,
        status: "pending",
        statusMessage: null,
        errorMessage: null,
        errorStack: null,
        input: {
          ...(e.input as object),
          continuation,
          previousArtifact: e.artifact,
        },
        artifact: null,
        logs: [],
      }));
    },
  };
}
```

- [ ] **Step 4: Run the test, verify pass**

Run: `npx vitest run tests/server/entity-store.test.ts`
Expected: PASS 9/9.

- [ ] **Step 5: Commit**

```bash
git add src/server/entity-store.ts tests/server/entity-store.test.ts
git commit -m "plan-1: entity store with atomic JSON writes"
```

---

## Task 5: Companion registry

**Files:**
- Create: `src/server/companion-registry.ts`
- Create: `companions/index.ts` (stub — empty array of companions)
- Test: `tests/server/companion-registry.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/server/companion-registry.test.ts
import { describe, it, expect } from "vitest";
import { createRegistry, type RegisteredCompanion } from "../../src/server/companion-registry";
import type { Manifest } from "@shared/types";

const fakeManifest = (name: string): Manifest => ({
  name,
  kind: "entity",
  displayName: name,
  icon: "🧪",
  description: "test companion",
  contractVersion: "1",
  version: "0.0.1",
});

describe("companion registry", () => {
  it("lists registered companions", () => {
    const a: RegisteredCompanion = { manifest: fakeManifest("a"), tools: {} };
    const b: RegisteredCompanion = { manifest: fakeManifest("b"), tools: {} };
    const r = createRegistry([a, b]);
    expect(r.list().map((c) => c.manifest.name)).toEqual(["a", "b"]);
  });

  it("looks up by name", () => {
    const a: RegisteredCompanion = { manifest: fakeManifest("a"), tools: {} };
    const r = createRegistry([a]);
    expect(r.get("a")?.manifest.displayName).toBe("a");
    expect(r.get("missing")).toBeNull();
  });

  it("refuses unknown contractVersion", () => {
    const bad: RegisteredCompanion = {
      manifest: { ...fakeManifest("x"), contractVersion: "99" },
      tools: {},
    };
    expect(() => createRegistry([bad])).toThrow(/contractVersion/);
  });
});
```

- [ ] **Step 2: Run the test, verify fail**

Run: `npx vitest run tests/server/companion-registry.test.ts`
Expected: FAIL — Cannot find module.

- [ ] **Step 3: Write `src/server/companion-registry.ts`**

```ts
import type { Manifest } from "../shared/types.js";

export const SUPPORTED_CONTRACT_VERSION = "1";

export interface RegisteredCompanion {
  manifest: Manifest;
  tools: Record<string, ToolHandler>;
}

export type ToolHandler = (args: unknown) => Promise<unknown> | unknown;

export interface Registry {
  list(): RegisteredCompanion[];
  get(name: string): RegisteredCompanion | null;
}

export function createRegistry(companions: RegisteredCompanion[]): Registry {
  for (const c of companions) {
    if (c.manifest.contractVersion !== SUPPORTED_CONTRACT_VERSION) {
      throw new Error(
        `companion ${c.manifest.name} declares contractVersion=${c.manifest.contractVersion}; host supports ${SUPPORTED_CONTRACT_VERSION}`
      );
    }
  }
  const byName = new Map(companions.map((c) => [c.manifest.name, c]));
  return {
    list: () => [...byName.values()],
    get: (name) => byName.get(name) ?? null,
  };
}
```

- [ ] **Step 4: Write the stub `companions/index.ts`**

```ts
// Generated re-exports for all local companions.
// Plan 1 contains a single companion (expense-tracker) registered in Task 17.
// For now this is empty so the server can boot.
import type { RegisteredCompanion } from "../src/server/companion-registry.js";

export const companions: RegisteredCompanion[] = [];
```

- [ ] **Step 5: Run the test, verify pass**

Run: `npx vitest run tests/server/companion-registry.test.ts`
Expected: PASS 3/3.

- [ ] **Step 6: Commit**

```bash
git add src/server/companion-registry.ts companions/index.ts tests/server/companion-registry.test.ts
git commit -m "plan-1: companion registry with contract version gate"
```

---

## Task 6: REST API routes

**Files:**
- Create: `src/server/api-routes.ts`
- Test: `tests/server/api-routes.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/server/api-routes.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEntityStore } from "../../src/server/entity-store";
import { createRegistry } from "../../src/server/companion-registry";
import { mountApiRoutes } from "../../src/server/api-routes";
import type { Manifest } from "@shared/types";

const manifest = (name: string): Manifest => ({
  name,
  kind: "entity",
  displayName: name,
  icon: "🧪",
  description: "t",
  contractVersion: "1",
  version: "0.0.1",
});

let app: express.Express;
let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "claudepanion-api-"));
  const store = createEntityStore(tmp);
  const registry = createRegistry([{ manifest: manifest("x"), tools: {} }]);
  app = express();
  app.use(express.json());
  mountApiRoutes(app, { store, registry });
});

describe("api routes", () => {
  it("GET /api/companions returns manifests", async () => {
    const res = await request(app).get("/api/companions");
    expect(res.status).toBe(200);
    expect(res.body.map((m: Manifest) => m.name)).toEqual(["x"]);
  });

  it("POST /api/entities creates an entity", async () => {
    const res = await request(app)
      .post("/api/entities")
      .send({ companion: "x", input: { foo: 1 } });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^x-[0-9a-f]{6}$/);
    expect(res.body.status).toBe("pending");
    expect(res.body.input).toEqual({ foo: 1 });
  });

  it("POST /api/entities 404s on unknown companion", async () => {
    const res = await request(app)
      .post("/api/entities")
      .send({ companion: "nope", input: {} });
    expect(res.status).toBe(404);
  });

  it("GET /api/entities/:id round-trips a created entity", async () => {
    const create = await request(app)
      .post("/api/entities")
      .send({ companion: "x", input: { a: 1 } });
    const got = await request(app).get(`/api/entities/${create.body.id}?companion=x`);
    expect(got.status).toBe(200);
    expect(got.body.id).toBe(create.body.id);
  });

  it("GET /api/entities?companion=x lists", async () => {
    await request(app).post("/api/entities").send({ companion: "x", input: {} });
    await request(app).post("/api/entities").send({ companion: "x", input: {} });
    const res = await request(app).get("/api/entities?companion=x");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it("POST /api/entities/:id/continue flips to pending", async () => {
    const c = await request(app).post("/api/entities").send({ companion: "x", input: {} });
    // simulate completion
    const store = createEntityStore(tmp);
    await store.saveArtifact("x", c.body.id, { done: true });
    const res = await request(app)
      .post(`/api/entities/${c.body.id}/continue`)
      .send({ companion: "x", continuation: "try again" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending");
    expect(res.body.input.continuation).toBe("try again");
  });
});

import { afterEach } from "vitest";
afterEach(() => {
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
});
```

- [ ] **Step 2: Run the test, verify fail**

Run: `npx vitest run tests/server/api-routes.test.ts`
Expected: FAIL — Cannot find `api-routes`.

- [ ] **Step 3: Write `src/server/api-routes.ts`**

```ts
import type { Express, Request, Response } from "express";
import type { EntityStore } from "./entity-store.js";
import type { Registry } from "./companion-registry.js";
import { generateEntityId } from "./id.js";

export interface ApiDeps {
  store: EntityStore;
  registry: Registry;
}

export function mountApiRoutes(app: Express, { store, registry }: ApiDeps): void {
  app.get("/api/companions", (_req: Request, res: Response) => {
    res.json(registry.list().map((c) => c.manifest));
  });

  app.get("/api/entities", async (req: Request, res: Response) => {
    const companion = String(req.query.companion ?? "");
    if (!companion) return res.status(400).json({ error: "companion query param required" });
    if (!registry.get(companion)) return res.status(404).json({ error: `unknown companion: ${companion}` });
    res.json(await store.list(companion));
  });

  app.get("/api/entities/:id", async (req: Request, res: Response) => {
    const companion = String(req.query.companion ?? "");
    if (!companion) return res.status(400).json({ error: "companion query param required" });
    const e = await store.get(companion, req.params.id);
    if (!e) return res.status(404).json({ error: "not found" });
    res.json(e);
  });

  app.post("/api/entities", async (req: Request, res: Response) => {
    const { companion, input } = req.body ?? {};
    if (!companion || typeof companion !== "string") {
      return res.status(400).json({ error: "companion required" });
    }
    if (!registry.get(companion)) {
      return res.status(404).json({ error: `unknown companion: ${companion}` });
    }
    const id = generateEntityId(companion);
    const entity = await store.create({ id, companion, input: input ?? {} });
    res.status(201).json(entity);
  });

  app.post("/api/entities/:id/continue", async (req: Request, res: Response) => {
    const { companion, continuation } = req.body ?? {};
    if (!companion) return res.status(400).json({ error: "companion required" });
    if (typeof continuation !== "string" || !continuation.trim()) {
      return res.status(400).json({ error: "continuation text required" });
    }
    await store.continueWith(companion, req.params.id, continuation);
    const e = await store.get(companion, req.params.id);
    res.json(e);
  });
}
```

- [ ] **Step 4: Run the test, verify pass**

Run: `npx vitest run tests/server/api-routes.test.ts`
Expected: PASS 6/6.

- [ ] **Step 5: Commit**

```bash
git add src/server/api-routes.ts tests/server/api-routes.test.ts
git commit -m "plan-1: REST API for entities and companions"
```

---

## Task 7: MCP server + auto-registered generic tools

**Files:**
- Create: `src/server/mcp.ts`
- Test: `tests/server/mcp.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/server/mcp.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEntityStore } from "../../src/server/entity-store";
import { createRegistry } from "../../src/server/companion-registry";
import { buildMcpServer } from "../../src/server/mcp";
import type { Manifest } from "@shared/types";

const manifest = (name: string): Manifest => ({
  name,
  kind: "entity",
  displayName: name,
  icon: "🧪",
  description: "t",
  contractVersion: "1",
  version: "0.0.1",
});

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "claudepanion-mcp-"));
});

describe("mcp server", () => {
  it("registers generic tools per entity companion", () => {
    const store = createEntityStore(tmp);
    const registry = createRegistry([{ manifest: manifest("x"), tools: {} }]);
    const { listToolNames } = buildMcpServer({ store, registry });
    const names = listToolNames();
    expect(names).toContain("x_get");
    expect(names).toContain("x_list");
    expect(names).toContain("x_update_status");
    expect(names).toContain("x_append_log");
    expect(names).toContain("x_save_artifact");
    expect(names).toContain("x_fail");
  });

  it("does not register generic tools for tool-kind companions", () => {
    const store = createEntityStore(tmp);
    const registry = createRegistry([
      { manifest: { ...manifest("t"), kind: "tool" }, tools: {} },
    ]);
    const { listToolNames } = buildMcpServer({ store, registry });
    expect(listToolNames()).not.toContain("t_get");
    expect(listToolNames()).not.toContain("t_list");
  });

  it("registers companion-declared domain tools", () => {
    const store = createEntityStore(tmp);
    const registry = createRegistry([
      {
        manifest: manifest("x"),
        tools: { x_domain_op: () => ({ ok: true }) },
      },
    ]);
    const { listToolNames } = buildMcpServer({ store, registry });
    expect(listToolNames()).toContain("x_domain_op");
  });

  it("x_get invokes entity store", async () => {
    const store = createEntityStore(tmp);
    const registry = createRegistry([{ manifest: manifest("x"), tools: {} }]);
    await store.create({ id: "x-1", companion: "x", input: { k: 1 } });
    const { invokeTool } = buildMcpServer({ store, registry });
    const result = await invokeTool("x_get", { id: "x-1" });
    expect((result as any).id).toBe("x-1");
  });

  it("x_append_log mutates entity", async () => {
    const store = createEntityStore(tmp);
    const registry = createRegistry([{ manifest: manifest("x"), tools: {} }]);
    await store.create({ id: "x-1", companion: "x", input: {} });
    const { invokeTool } = buildMcpServer({ store, registry });
    await invokeTool("x_append_log", { id: "x-1", message: "hi" });
    const e = await store.get("x", "x-1");
    expect(e?.logs[0].message).toBe("hi");
  });
});
```

- [ ] **Step 2: Run the test, verify fail**

Run: `npx vitest run tests/server/mcp.test.ts`
Expected: FAIL — missing module.

- [ ] **Step 3: Write `src/server/mcp.ts`**

The MCP SDK's Streamable HTTP transport is exercised via a real Express handler in Task 8. In this task we isolate tool registration behind a small `buildMcpServer` helper so it's unit-testable without the transport.

```ts
import type { EntityStore } from "./entity-store.js";
import type { Registry, ToolHandler } from "./companion-registry.js";

export interface McpDeps {
  store: EntityStore;
  registry: Registry;
}

export interface McpHandle {
  listToolNames(): string[];
  invokeTool(name: string, args: unknown): Promise<unknown>;
  handlers: Record<string, ToolHandler>;
}

export function buildMcpServer({ store, registry }: McpDeps): McpHandle {
  const handlers: Record<string, ToolHandler> = {};

  for (const c of registry.list()) {
    const name = c.manifest.name;

    if (c.manifest.kind === "entity") {
      handlers[`${name}_get`] = async (args: any) => {
        const e = await store.get(name, args.id);
        if (!e) throw new Error(`entity not found: ${name}/${args.id}`);
        return e;
      };
      handlers[`${name}_list`] = async (args: any) => {
        const all = await store.list(name);
        return args?.status ? all.filter((e) => e.status === args.status) : all;
      };
      handlers[`${name}_update_status`] = async (args: any) => {
        await store.updateStatus(name, args.id, args.status, args.statusMessage ?? null);
        return { ok: true };
      };
      handlers[`${name}_append_log`] = async (args: any) => {
        await store.appendLog(name, args.id, args.message, args.level ?? "info");
        return { ok: true };
      };
      handlers[`${name}_save_artifact`] = async (args: any) => {
        await store.saveArtifact(name, args.id, args.artifact);
        return { ok: true };
      };
      handlers[`${name}_fail`] = async (args: any) => {
        await store.fail(name, args.id, args.errorMessage, args.errorStack);
        return { ok: true };
      };
    }

    for (const [toolName, fn] of Object.entries(c.tools)) {
      handlers[toolName] = fn;
    }
  }

  return {
    listToolNames: () => Object.keys(handlers).sort(),
    invokeTool: async (name, args) => {
      const fn = handlers[name];
      if (!fn) throw new Error(`unknown tool: ${name}`);
      return await fn(args);
    },
    handlers,
  };
}
```

- [ ] **Step 4: Run the test, verify pass**

Run: `npx vitest run tests/server/mcp.test.ts`
Expected: PASS 5/5.

- [ ] **Step 5: Commit**

```bash
git add src/server/mcp.ts tests/server/mcp.test.ts
git commit -m "plan-1: MCP tool registry with generic+domain tools"
```

---

## Task 8: Express bootstrap + MCP transport mount + static serve

**Files:**
- Create: `src/server/index.ts`

- [ ] **Step 1: Write `src/server/index.ts`**

Note: The MCP Streamable HTTP transport is mounted at `/mcp`. We hand every tool invocation to the handlers built in Task 7. The existing `.mcp.json` already points at `http://localhost:3000/mcp`.

```ts
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createEntityStore } from "./entity-store.js";
import { createRegistry } from "./companion-registry.js";
import { mountApiRoutes } from "./api-routes.js";
import { buildMcpServer } from "./mcp.js";
import { companions } from "../../companions/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");

async function main() {
  const store = createEntityStore(resolve(repoRoot, "data"));
  const registry = createRegistry(companions);
  const mcp = buildMcpServer({ store, registry });

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  mountApiRoutes(app, { store, registry });

  const mcpServer = new McpServer({ name: "claudepanion", version: "0.2.0" });
  for (const [name, handler] of Object.entries(mcp.handlers)) {
    mcpServer.registerTool(
      name,
      { description: `auto-registered handler for ${name}`, inputSchema: z.any() },
      async (args: unknown) => {
        const result = await handler(args);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
  await mcpServer.connect(transport);
  app.all("/mcp", (req, res) => transport.handleRequest(req, res, req.body));

  const clientDir = join(repoRoot, "dist/client");
  app.use(express.static(clientDir));
  app.get("*", (_req, res) => res.sendFile(join(clientDir, "index.html")));

  app.listen(PORT, () => {
    console.log(`claudepanion listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify the server starts and serves `/api/companions`**

Run: `npx tsx src/server/index.ts &` (in a terminal)
Then: `curl -s http://localhost:3000/api/companions`
Expected: `[]` (empty array, since no companions registered yet)
Then: kill the background process with `kill %1` or `pkill -f "tsx src/server/index.ts"`.

- [ ] **Step 3: Verify `tsc --noEmit` passes**

Run: `npm run check`
Expected: clean exit (0).

- [ ] **Step 4: Commit**

```bash
git add src/server/index.ts
git commit -m "plan-1: express + MCP bootstrap serving empty registry"
```

---

## Task 9: Client scaffold — main.tsx, App.tsx, router

**Files:**
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`
- Create: `src/client/styles.css`

- [ ] **Step 1: Write `src/client/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 2: Write a minimal `src/client/App.tsx`**

```tsx
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import EntityList from "./pages/EntityList";
import NewEntity from "./pages/NewEntity";
import EntityDetail from "./pages/EntityDetail";

export default function App() {
  return (
    <div className="app">
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/c/expense-tracker" replace />} />
          <Route path="/c/:companion" element={<EntityList />} />
          <Route path="/c/:companion/new" element={<NewEntity />} />
          <Route path="/c/:companion/:id" element={<EntityDetail />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Write `src/client/styles.css`**

```css
:root {
  --bg: #ffffff;
  --fg: #0f172a;
  --muted: #64748b;
  --border: #e2e8f0;
  --brand: #0ea5e9;
  --sidebar: #0f172a;
  --sidebar-fg: #cbd5e1;
  --sidebar-active: #1e293b;
  --pending-bg: #e2e8f0;
  --pending-fg: #475569;
  --running-bg: #fef3c7;
  --running-fg: #92400e;
  --completed-bg: #dcfce7;
  --completed-fg: #166534;
  --error-bg: #fee2e2;
  --error-fg: #991b1b;
  --code-bg: #0c1220;
  --code-fg: #cbd5e1;
}

* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: var(--fg); background: var(--bg); }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.app { display: flex; min-height: 100vh; }
.app-sidebar { width: 220px; background: var(--sidebar); color: var(--sidebar-fg); padding: 16px 0; flex-shrink: 0; }
.app-main { flex: 1; padding: 24px 28px; overflow: auto; }

.sidebar-logo { padding: 0 16px 16px; display: flex; align-items: center; gap: 8px; color: #fff; font-weight: 600; }
.sidebar-logo-icon { width: 22px; height: 22px; background: var(--brand); border-radius: 6px; }
.sidebar-section-label { padding: 4px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; margin-top: 8px; }
.sidebar-link { padding: 8px 16px; display: flex; align-items: center; gap: 8px; color: var(--sidebar-fg); text-decoration: none; cursor: pointer; font-size: 13px; }
.sidebar-link:hover { background: #1a2438; color: #fff; }
.sidebar-link.active { background: var(--sidebar-active); color: #fff; border-left: 3px solid var(--brand); padding-left: 13px; }

.breadcrumb { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
.page-title { display: flex; justify-content: space-between; align-items: center; margin: 0 0 20px; }
.page-title h3 { margin: 0; }

.btn { background: var(--brand); color: #fff; border: 0; border-radius: 6px; padding: 8px 14px; font-size: 13px; font-weight: 500; cursor: pointer; }
.btn-secondary { background: #fff; color: #334155; border: 1px solid #cbd5e1; }
.btn:disabled { opacity: .5; cursor: not-allowed; }

.status-pill { padding: 4px 12px; border-radius: 999px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; }
.status-pill.pending { background: var(--pending-bg); color: var(--pending-fg); }
.status-pill.running { background: var(--running-bg); color: var(--running-fg); }
.status-pill.completed { background: var(--completed-bg); color: var(--completed-fg); }
.status-pill.error { background: var(--error-bg); color: var(--error-fg); }

.slash-command { background: linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
.slash-command-label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #0369a1; margin-bottom: 6px; }
.slash-command-hint { font-size: 14px; color: #075985; margin-bottom: 14px; }
.slash-command-row { display: flex; gap: 8px; align-items: stretch; }
.slash-command-code { flex: 1; background: var(--code-bg); color: #e2e8f0; border-radius: 8px; padding: 14px 16px; font-family: ui-monospace, monospace; font-size: 14px; display: flex; align-items: center; }
.slash-command-copy { background: var(--brand); color: #fff; border: 0; border-radius: 8px; padding: 0 18px; font-weight: 600; cursor: pointer; font-size: 13px; }

.status-bar { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; }
.status-bar-dot { width: 8px; height: 8px; background: #d97706; border-radius: 50%; flex-shrink: 0; }
.status-bar-label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #92400e; }
.status-bar-message { font-size: 14px; color: #78350f; margin-top: 2px; }

.panel { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
.panel-header { padding: 12px 16px; border-bottom: 1px solid var(--border); font-weight: 600; font-size: 14px; display: flex; justify-content: space-between; align-items: center; }
.panel-body { padding: 14px 16px; }

.logs { background: var(--code-bg); color: var(--code-fg); font-family: ui-monospace, monospace; font-size: 12px; padding: 12px 16px; max-height: 280px; overflow: auto; line-height: 1.55; }
.log-ts { color: #64748b; }
.log-level-info { color: #7dd3fc; }
.log-level-warn { color: #eab308; }
.log-level-error { color: #f87171; }

.stale-badge { display: inline-block; margin-left: 8px; background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 999px; font-size: 11px; }

.continuation { border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #fff; }
.continuation-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.continuation-hint { font-size: 12px; color: var(--muted); margin-bottom: 10px; }
.continuation-row { display: flex; gap: 8px; }
.continuation-input { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; font-size: 13px; }

.error-hero { border: 1px solid #fecaca; border-radius: 10px; margin-bottom: 16px; overflow: hidden; }
.error-hero-header { background: linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%); padding: 16px 18px; border-bottom: 1px solid #fecaca; }
.error-hero-label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #991b1b; margin-bottom: 4px; }
.error-hero-message { font-size: 14px; color: #7f1d1d; font-weight: 500; }
.error-hero-stack { background: var(--code-bg); color: #fca5a5; font-family: ui-monospace, monospace; font-size: 12px; padding: 12px 14px; border-radius: 6px; line-height: 1.5; white-space: pre-wrap; margin: 16px 18px; }

.artifact-hero { border: 1px solid #bbf7d0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; }
.artifact-hero-header { background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%); padding: 14px 18px; border-bottom: 1px solid #bbf7d0; }
.artifact-hero-label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #166534; }
.artifact-hero-title { font-size: 14px; color: #14532d; margin-top: 2px; }
.artifact-hero-body { padding: 18px; }
```

- [ ] **Step 2: Verify Vite dev server builds the scaffold**

Run: `npx vite build`
Expected: Build fails because `Sidebar`, `EntityList`, `NewEntity`, `EntityDetail` don't exist yet. That's expected — subsequent tasks create them. Skip this step until Task 15.

- [ ] **Step 3: Commit (after placing empty stubs to let tsc pass)**

First create placeholder stubs so the build compiles:

```tsx
// src/client/components/Sidebar.tsx
export default function Sidebar() { return <aside className="app-sidebar" />; }
```

```tsx
// src/client/pages/EntityList.tsx
export default function EntityList() { return <div>list</div>; }
```

```tsx
// src/client/pages/NewEntity.tsx
export default function NewEntity() { return <div>new</div>; }
```

```tsx
// src/client/pages/EntityDetail.tsx
export default function EntityDetail() { return <div>detail</div>; }
```

Run: `npm run check`
Expected: clean.

```bash
git add src/client
git commit -m "plan-1: client scaffold with router and styles"
```

---

## Task 10: Sidebar component

**Files:**
- Modify: `src/client/components/Sidebar.tsx`
- Create: `src/client/api.ts`
- Create: `src/client/hooks/useCompanions.ts`
- Test: `tests/client/Sidebar.test.tsx`

- [ ] **Step 1: Write `src/client/api.ts`**

```ts
import type { Entity, Manifest } from "@shared/types";

export async function fetchCompanions(): Promise<Manifest[]> {
  const res = await fetch("/api/companions");
  if (!res.ok) throw new Error(`GET /api/companions failed: ${res.status}`);
  return res.json();
}

export async function fetchEntity(companion: string, id: string): Promise<Entity> {
  const res = await fetch(`/api/entities/${encodeURIComponent(id)}?companion=${encodeURIComponent(companion)}`);
  if (!res.ok) throw new Error(`GET /api/entities/${id} failed: ${res.status}`);
  return res.json();
}

export async function fetchEntities(companion: string): Promise<Entity[]> {
  const res = await fetch(`/api/entities?companion=${encodeURIComponent(companion)}`);
  if (!res.ok) throw new Error(`GET /api/entities failed: ${res.status}`);
  return res.json();
}

export async function createEntity(companion: string, input: unknown): Promise<Entity> {
  const res = await fetch("/api/entities", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ companion, input }),
  });
  if (!res.ok) throw new Error(`POST /api/entities failed: ${res.status}`);
  return res.json();
}

export async function continueEntity(companion: string, id: string, continuation: string): Promise<Entity> {
  const res = await fetch(`/api/entities/${encodeURIComponent(id)}/continue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ companion, continuation }),
  });
  if (!res.ok) throw new Error(`POST continue failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Write `src/client/hooks/useCompanions.ts`**

```ts
import { useEffect, useState } from "react";
import type { Manifest } from "@shared/types";
import { fetchCompanions } from "../api";

export function useCompanions(): { companions: Manifest[]; loading: boolean } {
  const [companions, setCompanions] = useState<Manifest[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchCompanions().then((m) => {
      setCompanions(m);
      setLoading(false);
    });
  }, []);
  return { companions, loading };
}
```

- [ ] **Step 3: Write the test**

```tsx
// tests/client/Sidebar.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "../../src/client/components/Sidebar";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/companions") {
      return new Response(JSON.stringify([
        { name: "expense-tracker", kind: "entity", displayName: "Expense Tracker", icon: "💰", description: "", contractVersion: "1", version: "0.1.0" },
      ]), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }));
});

describe("Sidebar", () => {
  it("renders companions fetched from /api/companions", async () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Expense Tracker")).toBeInTheDocument());
    expect(screen.getByText("💰")).toBeInTheDocument();
  });

  it("renders static Core section with Build placeholder", async () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText(/Core/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the test, verify fail**

Run: `npx vitest run tests/client/Sidebar.test.tsx`
Expected: FAIL — element not found (Sidebar is still the empty stub).

- [ ] **Step 5: Write the real `src/client/components/Sidebar.tsx`**

```tsx
import { NavLink } from "react-router-dom";
import { useCompanions } from "../hooks/useCompanions";

export default function Sidebar() {
  const { companions } = useCompanions();
  const entities = companions.filter((c) => c.kind === "entity");
  const tools = companions.filter((c) => c.kind === "tool");

  return (
    <aside className="app-sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon" />
        <span>claudepanion</span>
      </div>
      <div className="sidebar-section-label">Core</div>
      <div className="sidebar-link" aria-disabled>🔨 Build <span style={{ marginLeft: "auto", fontSize: 10, color: "#64748b" }}>soon</span></div>
      {entities.length > 0 && (
        <>
          <div className="sidebar-section-label">Companions</div>
          {entities.map((c) => (
            <NavLink key={c.name} to={`/c/${c.name}`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
              <span>{c.icon}</span>
              <span>{c.displayName}</span>
            </NavLink>
          ))}
        </>
      )}
      {tools.length > 0 && (
        <>
          <div className="sidebar-section-label">Tools</div>
          {tools.map((c) => (
            <NavLink key={c.name} to={`/c/${c.name}`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
              <span>{c.icon}</span>
              <span>{c.displayName}</span>
            </NavLink>
          ))}
        </>
      )}
    </aside>
  );
}
```

- [ ] **Step 6: Run the test, verify pass**

Run: `npx vitest run tests/client/Sidebar.test.tsx`
Expected: PASS 2/2.

- [ ] **Step 7: Commit**

```bash
git add src/client/api.ts src/client/hooks/useCompanions.ts src/client/components/Sidebar.tsx tests/client/Sidebar.test.tsx
git commit -m "plan-1: sidebar + companion fetch"
```

---

## Task 11: useEntity polling hook

**Files:**
- Create: `src/client/hooks/useEntity.ts`
- Test: `tests/client/useEntity.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// tests/client/useEntity.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useEntity } from "../../src/client/hooks/useEntity";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useEntity", () => {
  it("fetches once on mount", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "x-1", status: "pending", logs: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useEntity("x", "x-1"));
    await vi.runOnlyPendingTimersAsync();
    await waitFor(() => expect(result.current.entity?.id).toBe("x-1"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("polls every 2s while status is pending or running", async () => {
    let count = 0;
    const fetchMock = vi.fn(async () => {
      count++;
      return new Response(JSON.stringify({ id: "x-1", status: "running", logs: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() => useEntity("x", "x-1"));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it("stops polling once status is completed", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "x-1", status: "completed", logs: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() => useEntity("x", "x-1"));
    await vi.advanceTimersByTimeAsync(0);
    const before = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchMock.mock.calls.length).toBe(before);
  });
});
```

- [ ] **Step 2: Run the test, verify fail**

Run: `npx vitest run tests/client/useEntity.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/client/hooks/useEntity.ts`**

```ts
import { useEffect, useRef, useState } from "react";
import type { Entity } from "@shared/types";
import { fetchEntity } from "../api";

const POLL_INTERVAL_MS = 2000;

export function useEntity(companion: string, id: string): { entity: Entity | null; error: Error | null; refetch: () => Promise<void> } {
  const [entity, setEntity] = useState<Entity | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tick = async () => {
    try {
      const e = await fetchEntity(companion, id);
      setEntity(e);
      setError(null);
      if (e.status === "pending" || e.status === "running") {
        timerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
      }
    } catch (err) {
      setError(err as Error);
      timerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    }
  };

  useEffect(() => {
    void tick();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companion, id]);

  return { entity, error, refetch: tick };
}
```

- [ ] **Step 4: Run the test, verify pass**

Run: `npx vitest run tests/client/useEntity.test.tsx`
Expected: PASS 3/3.

- [ ] **Step 5: Commit**

```bash
git add src/client/hooks/useEntity.ts tests/client/useEntity.test.tsx
git commit -m "plan-1: useEntity polling hook"
```

---

## Task 12: Presentational components (StatusPill, SlashCommandBlock, LogsPanel, StatusBar, StaleBadge)

**Files:**
- Create: `src/client/components/StatusPill.tsx`
- Create: `src/client/components/SlashCommandBlock.tsx`
- Create: `src/client/components/LogsPanel.tsx`
- Create: `src/client/components/StatusBar.tsx`
- Create: `src/client/components/StaleBadge.tsx`
- Test: `tests/client/StatusPill.test.tsx`
- Test: `tests/client/SlashCommandBlock.test.tsx`
- Test: `tests/client/LogsPanel.test.tsx`

- [ ] **Step 1: Write `StatusPill` test**

```tsx
// tests/client/StatusPill.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusPill from "../../src/client/components/StatusPill";

describe("StatusPill", () => {
  it.each(["pending", "running", "completed", "error"] as const)("renders %s with matching class", (s) => {
    render(<StatusPill status={s} />);
    const el = screen.getByText(s);
    expect(el.className).toContain(s);
  });
});
```

- [ ] **Step 2: Run test, verify fail, then write `StatusPill.tsx`**

```tsx
// src/client/components/StatusPill.tsx
import type { EntityStatus } from "@shared/types";

export default function StatusPill({ status }: { status: EntityStatus }) {
  return <span className={`status-pill ${status}`}>{status}</span>;
}
```

Run: `npx vitest run tests/client/StatusPill.test.tsx` → PASS.

- [ ] **Step 3: Write `SlashCommandBlock` test**

```tsx
// tests/client/SlashCommandBlock.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SlashCommandBlock from "../../src/client/components/SlashCommandBlock";

describe("SlashCommandBlock", () => {
  it("renders the slash command text", () => {
    render(<SlashCommandBlock command="/foo-companion foo-abc" />);
    expect(screen.getByText("/foo-companion foo-abc")).toBeInTheDocument();
  });

  it("calls navigator.clipboard.writeText on Copy click", () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<SlashCommandBlock command="/foo-companion foo-abc" />);
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith("/foo-companion foo-abc");
  });
});
```

- [ ] **Step 4: Write `SlashCommandBlock.tsx`**

```tsx
// src/client/components/SlashCommandBlock.tsx
import { useState } from "react";

export default function SlashCommandBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="slash-command">
      <div className="slash-command-label">Hand off to Claude</div>
      <div className="slash-command-hint">Paste this in Claude Code to start work on this entity:</div>
      <div className="slash-command-row">
        <div className="slash-command-code">{command}</div>
        <button className="slash-command-copy" onClick={copy}>{copied ? "✓ Copied" : "📋 Copy"}</button>
      </div>
    </div>
  );
}
```

Run: `npx vitest run tests/client/SlashCommandBlock.test.tsx` → PASS.

- [ ] **Step 5: Write `LogsPanel` test**

```tsx
// tests/client/LogsPanel.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LogsPanel from "../../src/client/components/LogsPanel";

describe("LogsPanel", () => {
  it("renders an empty placeholder when no logs and waiting", () => {
    render(<LogsPanel logs={[]} waiting />);
    expect(screen.getByText(/Waiting for Claude/i)).toBeInTheDocument();
  });

  it("renders log entries with level classes", () => {
    render(<LogsPanel logs={[
      { timestamp: "2026-04-22T10:00:00Z", level: "info", message: "hello" },
      { timestamp: "2026-04-22T10:00:01Z", level: "warn", message: "careful" },
    ]} />);
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("careful")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Write `LogsPanel.tsx`**

```tsx
// src/client/components/LogsPanel.tsx
import type { LogEntry } from "@shared/types";

export default function LogsPanel({ logs, waiting, polling }: { logs: LogEntry[]; waiting?: boolean; polling?: boolean }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <span>Logs {polling && <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>· polling every 2s</span>}</span>
        <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>{logs.length} entries</span>
      </div>
      {logs.length === 0 && waiting ? (
        <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          Waiting for Claude to start…
          <br />
          <span style={{ fontSize: 12 }}>Logs appear here once the slash command is run.</span>
        </div>
      ) : (
        <div className="logs">
          {logs.map((l, i) => (
            <div key={i}>
              <span className="log-ts">{l.timestamp.slice(11, 19)}</span>{" "}
              <span className={`log-level-${l.level}`}>{l.level}</span>{" "}
              {l.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Run: `npx vitest run tests/client/LogsPanel.test.tsx` → PASS.

- [ ] **Step 7: Write `StatusBar.tsx` (no separate test needed — covered by EntityDetail in Task 14)**

```tsx
// src/client/components/StatusBar.tsx
export default function StatusBar({ message, updatedAt }: { message: string; updatedAt: string }) {
  return (
    <div className="status-bar">
      <div className="status-bar-dot" />
      <div style={{ flex: 1 }}>
        <div className="status-bar-label">Current step</div>
        <div className="status-bar-message">{message}</div>
      </div>
      <div style={{ fontSize: 11, color: "#92400e", textAlign: "right" }}>{timeSince(updatedAt)}</div>
    </div>
  );
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}
```

- [ ] **Step 8: Write `StaleBadge.tsx`**

```tsx
// src/client/components/StaleBadge.tsx
export default function StaleBadge({ updatedAt, onRerun }: { updatedAt: string; onRerun: () => void }) {
  const minutes = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60_000);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
      <span className="stale-badge">last activity {minutes}m ago</span>
      <button className="btn btn-secondary" onClick={onRerun}>looks stalled — re-run?</button>
    </div>
  );
}
```

- [ ] **Step 9: Commit**

```bash
git add src/client/components tests/client/StatusPill.test.tsx tests/client/SlashCommandBlock.test.tsx tests/client/LogsPanel.test.tsx
git commit -m "plan-1: presentational components for detail page"
```

---

## Task 13: ContinuationForm component

**Files:**
- Create: `src/client/components/ContinuationForm.tsx`
- Test: `tests/client/ContinuationForm.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// tests/client/ContinuationForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ContinuationForm from "../../src/client/components/ContinuationForm";

describe("ContinuationForm", () => {
  it("calls onSubmit with trimmed text on submit", () => {
    const onSubmit = vi.fn();
    render(<ContinuationForm onSubmit={onSubmit} title="revise" hint="h" cta="Continue" placeholder="p" />);
    fireEvent.change(screen.getByPlaceholderText("p"), { target: { value: "  redo it  " } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSubmit).toHaveBeenCalledWith("redo it");
  });

  it("does not submit when empty", () => {
    const onSubmit = vi.fn();
    render(<ContinuationForm onSubmit={onSubmit} title="revise" hint="h" cta="Continue" placeholder="p" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Write `ContinuationForm.tsx`**

```tsx
// src/client/components/ContinuationForm.tsx
import { useState } from "react";

interface Props {
  title: string;
  hint: string;
  cta: string;
  placeholder: string;
  onSubmit: (text: string) => void;
}

export default function ContinuationForm({ title, hint, cta, placeholder, onSubmit }: Props) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSubmit(t);
    setText("");
  };
  return (
    <div className="continuation">
      <div className="continuation-title">{title}</div>
      <div className="continuation-hint">{hint}</div>
      <div className="continuation-row">
        <input
          className="continuation-input"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        <button className="btn" onClick={submit}>{cta}</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run tests, verify pass**

Run: `npx vitest run tests/client/ContinuationForm.test.tsx`
Expected: PASS 2/2.

- [ ] **Step 4: Commit**

```bash
git add src/client/components/ContinuationForm.tsx tests/client/ContinuationForm.test.tsx
git commit -m "plan-1: continuation form component"
```

---

## Task 14: EntityDetail page — all four states

**Files:**
- Modify: `src/client/pages/EntityDetail.tsx`
- Test: `tests/client/EntityDetail.test.tsx`

The companion's `pages/Detail.tsx` only renders the *artifact body*. The host owns the frame and morphs by state. To render the companion's artifact body we need the companion registry on the client too (dynamic import). For Plan 1 we take a shortcut: the registry exposes artifact renderers via a client-side map populated at build time. That map is defined in Task 18 (`companions/client.ts`). For now, `EntityDetail` takes an `artifactComponent` prop or falls back to a `<pre>` JSON dump.

- [ ] **Step 1: Write the test**

```tsx
// tests/client/EntityDetail.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import EntityDetail from "../../src/client/pages/EntityDetail";
import type { Entity } from "@shared/types";

function mockFetch(entity: Partial<Entity>) {
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify({
      id: "x-1", companion: "x", status: "pending", statusMessage: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      input: {}, artifact: null, errorMessage: null, errorStack: null, logs: [],
      ...entity,
    }), { status: 200 })
  ));
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/c/:companion/:id" element={<EntityDetail />} /></Routes>
    </MemoryRouter>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("EntityDetail", () => {
  it("renders slash command in pending state", async () => {
    mockFetch({ status: "pending" });
    renderAt("/c/x/x-1");
    await vi.runOnlyPendingTimersAsync();
    await waitFor(() => expect(screen.getByText("/x-companion x-1")).toBeInTheDocument());
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("renders amber status bar and logs in running state", async () => {
    mockFetch({ status: "running", statusMessage: "step 1", logs: [{ timestamp: "2026-04-22T10:00:00Z", level: "info", message: "hi" }] });
    renderAt("/c/x/x-1");
    await vi.runOnlyPendingTimersAsync();
    await waitFor(() => expect(screen.getByText("step 1")).toBeInTheDocument());
    expect(screen.getByText("hi")).toBeInTheDocument();
  });

  it("renders artifact JSON and continuation in completed state", async () => {
    mockFetch({ status: "completed", artifact: { total: 42 } });
    renderAt("/c/x/x-1");
    await vi.runOnlyPendingTimersAsync();
    await waitFor(() => expect(screen.getByText("completed")).toBeInTheDocument());
    expect(screen.getByText(/"total": 42/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });

  it("renders error message and stack in error state", async () => {
    mockFetch({ status: "error", errorMessage: "boom", errorStack: "at foo" });
    renderAt("/c/x/x-1");
    await vi.runOnlyPendingTimersAsync();
    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
    expect(screen.getByText(/at foo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, verify fail**

Run: `npx vitest run tests/client/EntityDetail.test.tsx`
Expected: FAIL — current EntityDetail is the "detail" stub.

- [ ] **Step 3: Write `src/client/pages/EntityDetail.tsx`**

```tsx
import { useParams, Link } from "react-router-dom";
import { useEntity } from "../hooks/useEntity";
import StatusPill from "../components/StatusPill";
import SlashCommandBlock from "../components/SlashCommandBlock";
import StatusBar from "../components/StatusBar";
import LogsPanel from "../components/LogsPanel";
import ContinuationForm from "../components/ContinuationForm";
import StaleBadge from "../components/StaleBadge";
import { continueEntity } from "../api";
import type { Entity } from "@shared/types";
import { getArtifactRenderer } from "../../../companions/client";

const STALE_MS = 10 * 60 * 1000;

export default function EntityDetail() {
  const { companion = "", id = "" } = useParams();
  const { entity, refetch } = useEntity(companion, id);

  if (!entity) {
    return <div style={{ color: "var(--muted)" }}>Loading…</div>;
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to={`/c/${companion}`}>{companion}</Link> / {entity.id}
      </div>
      <div className="page-title">
        <div>
          <h3>{describeEntity(entity)}</h3>
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
            {subtitle(entity)} · ID <code>{entity.id}</code>
          </div>
        </div>
        <StatusPill status={entity.status} />
      </div>

      {entity.status === "pending" && <PendingBody entity={entity} />}
      {entity.status === "running" && (
        <RunningBody entity={entity} onRerun={async () => { await continueEntity(companion, id, "retry"); await refetch(); }} />
      )}
      {entity.status === "completed" && (
        <CompletedBody entity={entity} onContinue={async (text) => { await continueEntity(companion, id, text); await refetch(); }} />
      )}
      {entity.status === "error" && (
        <ErrorBody entity={entity} onRetry={async (hint) => { await continueEntity(companion, id, hint || "retry"); await refetch(); }} />
      )}
    </>
  );
}

function describeEntity(e: Entity): string {
  const input = e.input as any;
  return input?.title ?? input?.description ?? e.companion;
}

function subtitle(e: Entity): string {
  if (e.status === "pending") return `Created ${timeAgo(e.createdAt)}`;
  if (e.status === "running") return `Started ${timeAgo(e.createdAt)}`;
  if (e.status === "completed") return `Completed · took ${duration(e.createdAt, e.updatedAt)}`;
  return `Failed · ran for ${duration(e.createdAt, e.updatedAt)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function duration(from: string, to: string): string {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function slashCommand(e: Entity): string {
  return `/${e.companion}-companion ${e.id}`;
}

function PendingBody({ entity }: { entity: Entity }) {
  return (
    <>
      <SlashCommandBlock command={slashCommand(entity)} />
      <InputPanel entity={entity} />
      <LogsPanel logs={[]} waiting />
    </>
  );
}

function RunningBody({ entity, onRerun }: { entity: Entity; onRerun: () => void }) {
  const stale = Date.now() - new Date(entity.updatedAt).getTime() > STALE_MS;
  return (
    <>
      {stale && <StaleBadge updatedAt={entity.updatedAt} onRerun={onRerun} />}
      {entity.statusMessage && <StatusBar message={entity.statusMessage} updatedAt={entity.updatedAt} />}
      <div className="panel" style={{ padding: "10px 14px", display: "flex", gap: 12, fontSize: 13, background: "#f8fafc" }}>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>Slash command</span>
        <code style={{ background: "var(--code-bg)", color: "#e2e8f0", padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>{slashCommand(entity)}</code>
      </div>
      <InputPanel entity={entity} collapsed />
      <LogsPanel logs={entity.logs} polling />
    </>
  );
}

function CompletedBody({ entity, onContinue }: { entity: Entity; onContinue: (text: string) => void }) {
  const Renderer = getArtifactRenderer(entity.companion);
  return (
    <>
      <div className="artifact-hero">
        <div className="artifact-hero-header">
          <div className="artifact-hero-label">Artifact</div>
          <div className="artifact-hero-title">Completed</div>
        </div>
        <div className="artifact-hero-body">
          {Renderer ? <Renderer entity={entity} /> : <pre>{JSON.stringify(entity.artifact, null, 2)}</pre>}
        </div>
      </div>
      <ContinuationForm
        title="Not quite right? Ask Claude to revise."
        hint="Describe what to change and get a new slash command. The artifact above is kept as context."
        cta="Continue"
        placeholder="e.g. 'redo with a tighter summary'"
        onSubmit={onContinue}
      />
      <InputPanel entity={entity} collapsed />
    </>
  );
}

function ErrorBody({ entity, onRetry }: { entity: Entity; onRetry: (hint: string) => void }) {
  return (
    <>
      <div className="error-hero">
        <div className="error-hero-header">
          <div className="error-hero-label">Error</div>
          <div className="error-hero-message">{entity.errorMessage}</div>
        </div>
        {entity.errorStack && <pre className="error-hero-stack">{entity.errorStack}</pre>}
      </div>
      <ContinuationForm
        title="Try again with a hint"
        hint="Describe a workaround. The original input is preserved."
        cta="Retry"
        placeholder="e.g. 'skip OCR, amount is $142.80'"
        onSubmit={onRetry}
      />
      <LogsPanel logs={entity.logs} />
      <InputPanel entity={entity} collapsed />
    </>
  );
}

function InputPanel({ entity, collapsed }: { entity: Entity; collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div className="panel" style={{ padding: "10px 14px", display: "flex", gap: 12, fontSize: 13, color: "var(--muted)" }}>
        <span>▸ Input</span>
        <span style={{ fontSize: 12 }}>{JSON.stringify(entity.input).slice(0, 200)}</span>
      </div>
    );
  }
  return (
    <div className="panel">
      <div className="panel-header">Input</div>
      <div className="panel-body">
        <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(entity.input, null, 2)}</pre>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `companions/client.ts` stub so the import resolves**

```ts
// companions/client.ts
// Client-side registry of artifact renderers, keyed by companion name.
// Each entity companion registers its Detail.tsx default export here.
import type { Entity } from "../src/shared/types";
import type { ComponentType } from "react";
import ExpenseTrackerDetail from "./expense-tracker/pages/Detail";

type ArtifactRenderer = ComponentType<{ entity: Entity }>;

const renderers: Record<string, ArtifactRenderer> = {
  "expense-tracker": ExpenseTrackerDetail as ArtifactRenderer,
};

export function getArtifactRenderer(name: string): ArtifactRenderer | undefined {
  return renderers[name];
}
```

Note: `ExpenseTrackerDetail` is created in Task 17. Until then, create a temporary stub:

```tsx
// companions/expense-tracker/pages/Detail.tsx (temporary stub — replaced in Task 17)
export default function Detail() { return <pre>stub</pre>; }
```

Also create the companion directory now:

```bash
mkdir -p companions/expense-tracker/pages
```

- [ ] **Step 5: Run the test, verify pass**

Run: `npx vitest run tests/client/EntityDetail.test.tsx`
Expected: PASS 4/4.

- [ ] **Step 6: Commit**

```bash
git add src/client/pages/EntityDetail.tsx companions/client.ts companions/expense-tracker tests/client/EntityDetail.test.tsx
git commit -m "plan-1: EntityDetail with all four state morphs"
```

---

## Task 15: EntityList page

**Files:**
- Modify: `src/client/pages/EntityList.tsx`
- Test: `tests/client/EntityList.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// tests/client/EntityList.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import EntityList from "../../src/client/pages/EntityList";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.startsWith("/api/companions")) {
      return new Response(JSON.stringify([
        { name: "x", kind: "entity", displayName: "Xer", icon: "🧪", description: "", contractVersion: "1", version: "0.1.0" },
      ]), { status: 200 });
    }
    if (url.startsWith("/api/entities?companion=x")) {
      return new Response(JSON.stringify([
        { id: "x-1", companion: "x", status: "running", statusMessage: null, createdAt: "2026-04-22T10:00:00Z", updatedAt: "2026-04-22T10:01:00Z", input: { description: "thing one" }, artifact: null, errorMessage: null, errorStack: null, logs: [] },
      ]), { status: 200 });
    }
    throw new Error(`unexpected ${url}`);
  }));
});
afterEach(() => vi.restoreAllMocks());

describe("EntityList", () => {
  it("renders companion title and entity rows", async () => {
    render(
      <MemoryRouter initialEntries={["/c/x"]}>
        <Routes><Route path="/c/:companion" element={<EntityList />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Xer")).toBeInTheDocument());
    expect(screen.getByText("thing one")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write `src/client/pages/EntityList.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import type { Entity, Manifest } from "@shared/types";
import { fetchCompanions, fetchEntities } from "../api";
import StatusPill from "../components/StatusPill";
import { getListRow } from "../../../companions/client";

export default function EntityList() {
  const { companion = "" } = useParams();
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    void fetchCompanions().then((all) => setManifest(all.find((m) => m.name === companion) ?? null));
    void fetchEntities(companion).then(setEntities);
  }, [companion]);

  if (!manifest) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  const Row = getListRow(companion);

  return (
    <>
      <div className="breadcrumb">Companions / {manifest.displayName}</div>
      <div className="page-title">
        <h3>{manifest.displayName}</h3>
        <button className="btn" onClick={() => navigate(`/c/${companion}/new`)}>+ New</button>
      </div>
      <div className="panel">
        <div className="panel-header" style={{ display: "grid", gridTemplateColumns: "90px 1fr 120px", fontSize: 12, color: "var(--muted)", fontWeight: 400, background: "#f8fafc" }}>
          <div>Status</div>
          <div>Description</div>
          <div>Updated</div>
        </div>
        {entities.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No entries yet — click "+ New" to get started.</div>
        ) : (
          entities.map((e) => (
            <Link key={e.id} to={`/c/${companion}/${e.id}`} style={{ display: "grid", gridTemplateColumns: "90px 1fr 120px", padding: "12px 14px", borderTop: "1px solid var(--border)", alignItems: "center", fontSize: 13, textDecoration: "none", color: "inherit" }}>
              <StatusPill status={e.status} />
              {Row ? <Row entity={e} /> : <div>{JSON.stringify(e.input).slice(0, 80)}</div>}
              <div style={{ color: "var(--muted)" }}>{timeAgo(e.updatedAt)}</div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}
```

- [ ] **Step 3: Extend `companions/client.ts` with `getListRow`**

```ts
// companions/client.ts — extended
import type { Entity } from "../src/shared/types";
import type { ComponentType } from "react";
import ExpenseTrackerDetail from "./expense-tracker/pages/Detail";
import ExpenseTrackerListRow from "./expense-tracker/pages/List";

type ArtifactRenderer = ComponentType<{ entity: Entity }>;
type ListRow = ComponentType<{ entity: Entity }>;

const artifactRenderers: Record<string, ArtifactRenderer> = {
  "expense-tracker": ExpenseTrackerDetail as ArtifactRenderer,
};

const listRows: Record<string, ListRow> = {
  "expense-tracker": ExpenseTrackerListRow as ListRow,
};

export function getArtifactRenderer(name: string): ArtifactRenderer | undefined {
  return artifactRenderers[name];
}

export function getListRow(name: string): ListRow | undefined {
  return listRows[name];
}
```

Also create a temporary stub for `expense-tracker/pages/List.tsx` (Task 17 replaces it):

```tsx
// companions/expense-tracker/pages/List.tsx (stub)
export default function ListRow() { return <div>stub</div>; }
```

- [ ] **Step 4: Run the test, verify pass**

Run: `npx vitest run tests/client/EntityList.test.tsx`
Expected: PASS 1/1.

- [ ] **Step 5: Commit**

```bash
git add src/client/pages/EntityList.tsx companions/client.ts companions/expense-tracker/pages/List.tsx tests/client/EntityList.test.tsx
git commit -m "plan-1: EntityList page with per-companion row renderer"
```

---

## Task 16: NewEntity page

**Files:**
- Modify: `src/client/pages/NewEntity.tsx`
- Extend: `companions/client.ts` with `getForm`
- Test: `tests/client/NewEntity.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// tests/client/NewEntity.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import NewEntity from "../../src/client/pages/NewEntity";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/companions") {
      return new Response(JSON.stringify([
        { name: "expense-tracker", kind: "entity", displayName: "Expense Tracker", icon: "💰", description: "", contractVersion: "1", version: "0.1.0" },
      ]), { status: 200 });
    }
    if (url === "/api/entities" && init?.method === "POST") {
      return new Response(JSON.stringify({ id: "expense-tracker-aaa111", companion: "expense-tracker", status: "pending", input: JSON.parse(String(init.body)).input, logs: [], createdAt: "", updatedAt: "", statusMessage: null, artifact: null, errorMessage: null, errorStack: null }), { status: 201 });
    }
    throw new Error(`unexpected ${url}`);
  }));
});
afterEach(() => vi.restoreAllMocks());

describe("NewEntity", () => {
  it("renders the companion's form and navigates to detail on submit", async () => {
    render(
      <MemoryRouter initialEntries={["/c/expense-tracker/new"]}>
        <Routes>
          <Route path="/c/:companion/new" element={<NewEntity />} />
          <Route path="/c/:companion/:id" element={<div>detail-page</div>} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByLabelText(/description/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "lunch" } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "25.50" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));
    await waitFor(() => expect(screen.getByText("detail-page")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Write `src/client/pages/NewEntity.tsx`**

```tsx
import { useParams, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Manifest } from "@shared/types";
import { createEntity, fetchCompanions } from "../api";
import { getForm } from "../../../companions/client";

export default function NewEntity() {
  const { companion = "" } = useParams();
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<Manifest | null>(null);

  useEffect(() => {
    void fetchCompanions().then((all) => setManifest(all.find((m) => m.name === companion) ?? null));
  }, [companion]);

  if (!manifest) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  const Form = getForm(companion);
  if (!Form) return <div>No form registered for {companion}.</div>;

  return (
    <>
      <div className="breadcrumb"><Link to={`/c/${companion}`}>{manifest.displayName}</Link> / New</div>
      <div className="page-title"><h3>New {manifest.displayName}</h3></div>
      <Form onSubmit={async (input) => {
        const e = await createEntity(companion, input);
        navigate(`/c/${companion}/${e.id}`);
      }} />
    </>
  );
}
```

- [ ] **Step 3: Extend `companions/client.ts` with `getForm`**

Final content of `companions/client.ts`:

```ts
import type { Entity } from "../src/shared/types";
import type { ComponentType } from "react";
import ExpenseTrackerDetail from "./expense-tracker/pages/Detail";
import ExpenseTrackerListRow from "./expense-tracker/pages/List";
import ExpenseTrackerForm from "./expense-tracker/form";

type ArtifactRenderer = ComponentType<{ entity: Entity }>;
type ListRow = ComponentType<{ entity: Entity }>;
type CompanionForm = ComponentType<{ onSubmit: (input: unknown) => void | Promise<void> }>;

const artifactRenderers: Record<string, ArtifactRenderer> = {
  "expense-tracker": ExpenseTrackerDetail as ArtifactRenderer,
};
const listRows: Record<string, ListRow> = {
  "expense-tracker": ExpenseTrackerListRow as ListRow,
};
const forms: Record<string, CompanionForm> = {
  "expense-tracker": ExpenseTrackerForm as CompanionForm,
};

export function getArtifactRenderer(name: string): ArtifactRenderer | undefined { return artifactRenderers[name]; }
export function getListRow(name: string): ListRow | undefined { return listRows[name]; }
export function getForm(name: string): CompanionForm | undefined { return forms[name]; }
```

Create a stub `companions/expense-tracker/form.tsx`:

```tsx
// companions/expense-tracker/form.tsx (stub — replaced in Task 17)
export default function Form() { return <div>stub form</div>; }
```

- [ ] **Step 4: Run the test — currently it depends on the real form (Task 17). Skip until after Task 17.**

Mark this step as "defer verification to post-Task-17".

- [ ] **Step 5: Commit**

```bash
git add src/client/pages/NewEntity.tsx companions/client.ts companions/expense-tracker/form.tsx tests/client/NewEntity.test.tsx
git commit -m "plan-1: NewEntity page + per-companion form resolver"
```

---

## Task 17: Expense-tracker companion (manifest, types, form, pages, tools)

**Files:**
- Create: `companions/expense-tracker/manifest.ts`
- Create: `companions/expense-tracker/types.ts`
- Modify: `companions/expense-tracker/form.tsx` (replaces stub)
- Modify: `companions/expense-tracker/pages/List.tsx` (replaces stub)
- Modify: `companions/expense-tracker/pages/Detail.tsx` (replaces stub)
- Create: `companions/expense-tracker/server/tools.ts`
- Create: `companions/expense-tracker/index.ts`
- Modify: `companions/index.ts` (register expense-tracker)

- [ ] **Step 1: Write `companions/expense-tracker/manifest.ts`**

```ts
import type { Manifest } from "../../src/shared/types";

export const manifest: Manifest = {
  name: "expense-tracker",
  kind: "entity",
  displayName: "Expense Tracker",
  icon: "💰",
  description: "Log expenses with a description and amount; Claude tags each and summarizes.",
  contractVersion: "1",
  version: "0.1.0",
};
```

- [ ] **Step 2: Write `companions/expense-tracker/types.ts`**

```ts
export interface ExpenseInput {
  description: string;
  amount: number;
  // populated by host when continuing:
  continuation?: string;
  previousArtifact?: ExpenseArtifact | null;
}

export interface ExpenseArtifact {
  tag: "food" | "travel" | "office" | "other";
  summary: string;
}
```

- [ ] **Step 3: Replace `companions/expense-tracker/form.tsx`**

```tsx
import { useState } from "react";
import type { ExpenseInput } from "./types";

interface Props {
  onSubmit: (input: ExpenseInput) => void | Promise<void>;
}

export default function ExpenseForm({ onSubmit }: Props) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!description.trim() || !Number.isFinite(amt)) return;
    void onSubmit({ description: description.trim(), amount: amt });
  };
  return (
    <form onSubmit={submit} style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
        Description
        <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
        Amount
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
      </label>
      <button className="btn" type="submit" style={{ alignSelf: "flex-start" }}>Create</button>
    </form>
  );
}
```

- [ ] **Step 4: Replace `companions/expense-tracker/pages/List.tsx`**

```tsx
import type { Entity } from "../../../src/shared/types";
import type { ExpenseInput, ExpenseArtifact } from "../types";

export default function ExpenseListRow({ entity }: { entity: Entity<ExpenseInput, ExpenseArtifact> }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
      <span style={{ fontWeight: 500 }}>{entity.input.description}</span>
      <span style={{ color: "var(--muted)" }}>${entity.input.amount.toFixed(2)}</span>
      {entity.artifact && (
        <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 999, fontSize: 11 }}>
          {entity.artifact.tag}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Replace `companions/expense-tracker/pages/Detail.tsx`**

```tsx
import type { Entity } from "../../../src/shared/types";
import type { ExpenseInput, ExpenseArtifact } from "../types";

export default function ExpenseArtifactBody({ entity }: { entity: Entity<ExpenseInput, ExpenseArtifact> }) {
  const a = entity.artifact;
  if (!a) return null;
  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{entity.input.description}</div>
        <div style={{ color: "var(--muted)", fontSize: 14 }}>${entity.input.amount.toFixed(2)}</div>
        <span style={{ background: "#dbeafe", color: "#1e40af", padding: "4px 12px", borderRadius: 999, fontSize: 12 }}>{a.tag}</span>
      </div>
      <p style={{ margin: 0, color: "#334155", lineHeight: 1.55 }}>{a.summary}</p>
    </div>
  );
}
```

- [ ] **Step 6: Write `companions/expense-tracker/server/tools.ts`**

```ts
// Domain tools specific to expense-tracker. Plan 1 has none — the generic
// <companion>_* plumbing is enough for Claude to read the input, classify,
// and save the artifact. Kept as an explicit empty export so the contract
// shape is uniform across companions.
import type { ToolHandler } from "../../../src/server/companion-registry";

export const tools: Record<string, ToolHandler> = {};
```

- [ ] **Step 7: Write `companions/expense-tracker/index.ts`**

```ts
import type { RegisteredCompanion } from "../../src/server/companion-registry";
import { manifest } from "./manifest";
import { tools } from "./server/tools";

export const expenseTracker: RegisteredCompanion = { manifest, tools };
```

- [ ] **Step 8: Update `companions/index.ts`**

```ts
import type { RegisteredCompanion } from "../src/server/companion-registry.js";
import { expenseTracker } from "./expense-tracker/index.js";

export const companions: RegisteredCompanion[] = [expenseTracker];
```

- [ ] **Step 9: Run the NewEntity test deferred from Task 16**

Run: `npx vitest run tests/client/NewEntity.test.tsx`
Expected: PASS 1/1.

- [ ] **Step 10: Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
git add companions/expense-tracker companions/index.ts
git commit -m "plan-1: expense-tracker reference companion"
```

---

## Task 18: Expense-tracker skill

**Files:**
- Create: `skills/expense-tracker-companion.md`

- [ ] **Step 1: Write the skill**

```markdown
---
name: expense-tracker-companion
description: Use when invoked as /expense-tracker-companion <entity-id>. Reads the expense entity from claudepanion, classifies the expense into a tag, writes a one-line summary, and saves the artifact.
---

# Expense Tracker Companion

You are the runtime for a single expense-tracker entity. You were invoked via:

```
/expense-tracker-companion <entity-id>
```

where `<entity-id>` is the argument passed to you.

## Playbook

1. **Load the entity.** Call the MCP tool `expense_tracker_get({ id })` where `id` is the argument. You'll get back an object with `input: { description, amount, continuation?, previousArtifact? }`.

2. **Mark as running.** Call `expense_tracker_update_status({ id, status: "running", statusMessage: "classifying" })`.

3. **Classify.** Choose exactly one tag from `food | travel | office | other` based on the description. If `continuation` is present, let the user's hint guide reclassification; use `previousArtifact` as prior context.

4. **Log a trace.** Call `expense_tracker_append_log({ id, message: "classified as <tag>" })`.

5. **Write a one-line summary** describing the expense in a single sentence.

6. **Save the artifact.** Call `expense_tracker_save_artifact({ id, artifact: { tag, summary } })`. This transitions status to `completed` automatically.

7. **On failure** — if anything throws or you can't classify, call `expense_tracker_fail({ id, errorMessage: "<short message>" })` and stop.

## Constraints

- Never edit files on disk for this companion — everything is through the MCP tools above.
- Keep the summary to one sentence.
- `tag` must be one of the four allowed values; no variants.
```

- [ ] **Step 2: Commit**

```bash
git add skills/expense-tracker-companion.md
git commit -m "plan-1: expense-tracker skill playbook"
```

---

## Task 19: End-to-end manual smoke

**Files:** none (documentation of verification steps)

- [ ] **Step 1: Build the client**

Run: `npx vite build`
Expected: `dist/client/index.html` and assets produced.

- [ ] **Step 2: Start the server**

Run: `npm run dev:server` (in one terminal)
Expected: `claudepanion listening on http://localhost:3000`.

- [ ] **Step 3: Start the Vite dev server**

Run: `npm run dev:client` (in another terminal)
Expected: Vite dev server on `http://localhost:5173`, proxying `/api` and `/mcp` to `:3000`.

- [ ] **Step 4: Verify sidebar shows Expense Tracker**

Open `http://localhost:5173/c/expense-tracker`.
Expected: sidebar shows "Companions" section with "💰 Expense Tracker"; main area shows "No entries yet".

- [ ] **Step 5: Create a pending entity**

Click `+ New`. Fill description "Lunch with design team", amount "48.20". Click Create.
Expected: navigates to `/c/expense-tracker/expense-tracker-XXXXXX`; pending state with slash command `/expense-tracker-companion expense-tracker-XXXXXX` displayed.

- [ ] **Step 6: Copy the slash command and run it in Claude Code**

Click Copy. Paste into Claude Code.
Expected: Claude invokes the skill, which transitions the entity to `running`, appends a log entry, classifies the expense, saves the artifact, flips to `completed`. The browser page updates live via 2s polling.

- [ ] **Step 7: Verify completed state**

Expected: the page now shows the artifact card with the description, amount, tag pill, and one-sentence summary. Continuation form is visible below.

- [ ] **Step 8: Submit a continuation**

Type "re-classify as office" in the continuation form. Click Continue.
Expected: entity flips back to `pending`; new slash command shown; `input.continuation = "re-classify as office"`; `input.previousArtifact` preserved.

- [ ] **Step 9: Error path check**

Create another expense, then in Claude Code manually call `expense_tracker_fail` with a fake error to force the error state.
Expected: entity reaches `error` state; red hero shows the error message; retry form visible; logs expanded.

- [ ] **Step 10: Commit the verification log**

```bash
# no code changes — just record that smoke passed
git commit --allow-empty -m "plan-1: end-to-end smoke verified"
```

---

## Self-review

**Spec coverage check:**

| Spec section                                                 | Plan task(s)            |
| ------------------------------------------------------------ | ----------------------- |
| Host process, React+Vite+Express                             | Task 1, 8, 9            |
| Entity kind contract (manifest, types, form, pages, server)  | Task 17                 |
| Tool kind contract                                           | deferred to Plan 4      |
| Entity data model                                            | Task 2                  |
| Entity storage as per-file JSON                              | Task 4                  |
| Generic MCP tools auto-registered per companion              | Task 7                  |
| Domain MCP tools companion-authored                          | Task 7, 17              |
| Slash-command handoff                                        | Task 14 (UI), Task 18   |
| Soft re-mount via manifest watcher                           | deferred to Plan 2      |
| UI routes                                                    | Task 9                  |
| App shell with sidebar sections                              | Task 10                 |
| Detail page — pending/running/completed/error states         | Task 14                 |
| Build bundled companion                                      | deferred to Plan 3      |
| Tool-companion About page                                    | deferred to Plan 4      |
| Contract version gating                                      | Task 5                  |
| Technology choices (React 18, Vite 6, etc.)                  | Task 1                  |
| Stale detection                                              | Task 12, 14             |
| Continuation as flip-to-pending preserving previous artifact | Task 4, 6, 14           |

Not covered in Plan 1 (by design): Build companion, tool kind, iteration, install flow, watcher, validator, smoke-test CLI. Deferred to Plans 2–6.

**Placeholder scan:** None. Every task has concrete code; the smoke-test task is explicit verification of state transitions.

**Type consistency:**
- `Entity<Input, Artifact>` used identically in Tasks 2, 4, 6, 14, 15, 17.
- `EntityStatus` as `"pending" | "running" | "completed" | "error"` across Tasks 2, 4, 7, 14.
- `Manifest` fields consistent: `name`, `kind`, `displayName`, `icon`, `description`, `contractVersion`, `version`.
- `RegisteredCompanion` shape `{ manifest, tools }` identical in Tasks 5, 7, 17.
- MCP tool naming: `<companion>_<verb>` everywhere.
- Hook shape `useEntity` returns `{ entity, error, refetch }` consistently.

---

## Ready to execute

All 19 tasks are TDD-oriented (test → fail → implement → pass → commit), with complete code blocks and exact commands. Deferred items are flagged and have a specific home in Plans 2–6.
