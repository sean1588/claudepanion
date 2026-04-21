# claudepanion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot `claude-manager` into `claudepanion` — a localhost companion host where Claude Code (over MCP) acts as the backend agent for small browser-based companion apps, with a bundled Build companion that scaffolds new companions.

**Architecture:** Single Express + SRH + SSE process. Companions live under `companions/<slug>/`, auto-discovered at startup. One MCP server exposes slug-prefixed tools. Build companion demonstrates the polling pattern (`<slug>_list/claim/log/complete`) it scaffolds.

**Tech Stack:** Node 20+, TypeScript, Express, `@modelcontextprotocol/sdk`, vanilla server-rendered HTML, native SSE, `zod` for tool schemas, vitest for tests.

**Reference spec:** `docs/superpowers/specs/2026-04-20-claudepanion-design.md` — authoritative source for design decisions. When plan and spec conflict, spec wins.

---

## Task 1: Install vitest and sanity test

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Create: `tests/unit/sanity.test.ts`

- [ ] **Step 1: Install vitest**

Run:
```bash
npm install --save-dev vitest @types/node
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10_000,
  },
});
```

- [ ] **Step 3: Add test script to `package.json`**

Modify the `scripts` block to include:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write the sanity test at `tests/unit/sanity.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the sanity test**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/unit/sanity.test.ts
git commit -m "test: add vitest harness with sanity test"
```

---

## Task 2: Core platform types

**Files:**
- Modify: `src/types.ts` (replace contents — Task/Skill types are removed in Task 16; for now coexist)
- Create: `src/mcp/types.ts` (keep McpToolDefinition here until Task 7 consolidates)

- [ ] **Step 1: Write a type-check test at `tests/unit/types.test.ts`**

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type { Companion, CompanionContext, McpToolDefinition } from '../../src/types.js';
import { z } from 'zod';

describe('Companion types', () => {
  it('Companion has required fields', () => {
    const c: Companion = {
      slug: 'demo',
      name: 'Demo',
      description: 'desc',
      tools: [],
      renderPage: async () => '',
      router: null,
    };
    expectTypeOf(c.slug).toBeString();
  });

  it('CompanionContext exposes broadcast, store, slug, log', () => {
    expectTypeOf<CompanionContext>().toHaveProperty('broadcast');
    expectTypeOf<CompanionContext>().toHaveProperty('store');
    expectTypeOf<CompanionContext>().toHaveProperty('slug');
    expectTypeOf<CompanionContext>().toHaveProperty('log');
  });

  it('McpToolDefinition has name, description, schema, handler', () => {
    const t: McpToolDefinition<{ x: string }> = {
      name: 'x',
      description: 'x',
      schema: { x: z.string() },
      async handler(p, ctx) {
        return { content: [{ type: 'text', text: p.x }] };
      },
    };
    expectTypeOf(t.name).toBeString();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/unit/types.test.ts`
Expected: FAIL — missing type exports.

- [ ] **Step 3: Rewrite `src/types.ts`**

```ts
import type { Router } from 'express';
import type { ZodRawShape, z } from 'zod';

export type Broadcast = (event: string, data: unknown) => void;

export interface CompanionStore<T> {
  read(): Promise<T>;
  write(data: T): Promise<void>;
}

export interface CompanionContext {
  slug: string;
  broadcast: Broadcast;
  store: CompanionStore<unknown>;
  log(...args: unknown[]): void;
}

export interface McpToolDefinition<TParams = Record<string, unknown>> {
  name: string;
  description: string;
  schema: ZodRawShape;
  handler(
    params: TParams,
    ctx: CompanionContext,
  ): Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }>;
}

export interface CompanionManifest {
  slug: string;
  name: string;
  description: string;
  icon?: string;
}

export interface Companion {
  slug: string;
  name: string;
  description: string;
  icon?: string;
  tools: McpToolDefinition[];
  renderPage(ctx: CompanionContext): Promise<string> | string;
  router: Router | null;
}

export function successResult(data: unknown): {
  content: Array<{ type: 'text'; text: string }>;
} {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(message: string): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  return { content: [{ type: 'text', text: message }], isError: true };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/unit/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck still passes for existing code**

Run: `npm run check`
Expected: errors only where `Task`/`Skill` types used to live (those will be removed in Task 16). If there are too many failures to type-check the new platform code, add `@ts-expect-error` comments in legacy files with a `TODO: removed in Task 16` note rather than leaving broken code.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts tests/unit/types.test.ts
git commit -m "feat: add Companion, CompanionContext, McpToolDefinition types"
```

---

## Task 3: Storage helper

**Files:**
- Create: `src/storage.ts`
- Create: `tests/unit/storage.test.ts`

- [ ] **Step 1: Write failing tests at `tests/unit/storage.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJsonFile, writeJsonFile } from '../../src/storage.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'claudepanion-test-'));
}

describe('storage', () => {
  it('writeJsonFile + readJsonFile round-trips', async () => {
    const dir = tempDir();
    const path = join(dir, 'test.json');
    await writeJsonFile(path, { hello: 'world', n: 42 });
    const data = await readJsonFile<{ hello: string; n: number }>(path);
    expect(data).toEqual({ hello: 'world', n: 42 });
  });

  it('readJsonFile returns default for missing file', async () => {
    const dir = tempDir();
    const path = join(dir, 'missing.json');
    const data = await readJsonFile(path, { requests: [] });
    expect(data).toEqual({ requests: [] });
  });

  it('writeJsonFile is atomic (no partial file if process dies mid-write)', async () => {
    const dir = tempDir();
    const path = join(dir, 'atomic.json');
    await writeJsonFile(path, { a: 1 });
    // Verify no .tmp sibling left behind
    expect(existsSync(path + '.tmp')).toBe(false);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ a: 1 });
  });

  it('readJsonFile throws descriptive error on malformed JSON', async () => {
    const dir = tempDir();
    const path = join(dir, 'bad.json');
    writeFileSync(path, 'not json{');
    await expect(readJsonFile(path)).rejects.toThrow(/parse/i);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/unit/storage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/storage.ts`**

```ts
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

export async function readJsonFile<T>(
  path: string,
  defaultValue?: T,
): Promise<T> {
  try {
    const text = await fs.readFile(path, 'utf8');
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new Error(
        `Failed to parse JSON at ${path}: ${(err as Error).message}`,
      );
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT' && defaultValue !== undefined) {
      return defaultValue;
    }
    throw err;
  }
}

export async function writeJsonFile(path: string, data: unknown): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  const json = JSON.stringify(data, null, 2);
  const handle = await fs.open(tmp, 'w');
  try {
    await handle.writeFile(json);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, path);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/unit/storage.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/storage.ts tests/unit/storage.test.ts
git commit -m "feat: add atomic JSON storage helpers"
```

---

## Task 4: Broadcast module

**Files:**
- Create: `src/broadcast.ts`
- Create: `tests/unit/broadcast.test.ts`

- [ ] **Step 1: Write failing tests at `tests/unit/broadcast.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createBroadcaster } from '../../src/broadcast.js';

describe('broadcaster', () => {
  it('fan-out to all subscribers', () => {
    const b = createBroadcaster();
    const a = vi.fn();
    const c = vi.fn();
    b.subscribe(a);
    b.subscribe(c);
    b.broadcast('e', { x: 1 });
    expect(a).toHaveBeenCalledWith('e', { x: 1 });
    expect(c).toHaveBeenCalledWith('e', { x: 1 });
  });

  it('unsubscribe stops further events', () => {
    const b = createBroadcaster();
    const s = vi.fn();
    const unsubscribe = b.subscribe(s);
    b.broadcast('e', 1);
    unsubscribe();
    b.broadcast('e', 2);
    expect(s).toHaveBeenCalledTimes(1);
  });

  it('handler errors do not block other subscribers', () => {
    const b = createBroadcaster();
    b.subscribe(() => { throw new Error('boom'); });
    const s = vi.fn();
    b.subscribe(s);
    expect(() => b.broadcast('e', 1)).not.toThrow();
    expect(s).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/unit/broadcast.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/broadcast.ts`**

```ts
import type { Broadcast } from './types.js';

export interface Broadcaster {
  broadcast: Broadcast;
  subscribe(listener: Broadcast): () => void;
}

export function createBroadcaster(): Broadcaster {
  const listeners = new Set<Broadcast>();
  return {
    broadcast(event, data) {
      for (const l of listeners) {
        try { l(event, data); } catch { /* isolate failures */ }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/unit/broadcast.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/broadcast.ts tests/unit/broadcast.test.ts
git commit -m "feat: add in-process event broadcaster"
```

---

## Task 5: Request-store helper

**Files:**
- Create: `src/helpers/requestStore.ts`
- Create: `tests/unit/requestStore.test.ts`

- [ ] **Step 1: Write failing tests at `tests/unit/requestStore.test.ts`**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequestStore } from '../../src/helpers/requestStore.js';

function tempDataDir() {
  const d = mkdtempSync(join(tmpdir(), 'cp-req-'));
  process.env.CLAUDEPANION_DATA_DIR = d;
  return d;
}

describe('requestStore', () => {
  beforeEach(() => {
    tempDataDir();
  });

  it('create → list sees pending request', async () => {
    const s = createRequestStore('build');
    const req = await s.create('do the thing');
    expect(req.status).toBe('pending');
    expect(req.version).toBe(1);
    expect(req.description).toBe('do the thing');
    const all = await s.list();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(req.id);
  });

  it('claim moves pending → running and bumps version', async () => {
    const s = createRequestStore('build');
    const r = await s.create('x');
    const claimed = await s.claim(r.id, r.version);
    expect(claimed.status).toBe('running');
    expect(claimed.version).toBe(r.version + 1);
  });

  it('claim with stale version rejects with conflict', async () => {
    const s = createRequestStore('build');
    const r = await s.create('x');
    await s.claim(r.id, r.version);
    await expect(s.claim(r.id, r.version)).rejects.toThrow(/version|conflict/i);
  });

  it('claim on non-pending status rejects', async () => {
    const s = createRequestStore('build');
    const r = await s.create('x');
    await s.claim(r.id, r.version);
    // status is now 'running', cannot claim again
    const latest = (await s.get(r.id))!;
    await expect(s.claim(r.id, latest.version)).rejects.toThrow(/status|pending/i);
  });

  it('log appends entries and bumps version', async () => {
    const s = createRequestStore('build');
    const r = await s.create('x');
    await s.claim(r.id, r.version);
    await s.log(r.id, 'first');
    await s.log(r.id, 'second');
    const got = (await s.get(r.id))!;
    expect(got.logs.map((l) => l.message)).toEqual(['first', 'second']);
  });

  it('complete sets done + result', async () => {
    const s = createRequestStore('build');
    const r = await s.create('x');
    await s.claim(r.id, r.version);
    await s.complete(r.id, {
      summary: '# done',
      files: [{ path: 'companions/x/manifest.json', bytes: 10 }],
    });
    const got = (await s.get(r.id))!;
    expect(got.status).toBe('done');
    expect(got.result?.summary).toBe('# done');
  });

  it('fail sets failed + error', async () => {
    const s = createRequestStore('build');
    const r = await s.create('x');
    await s.claim(r.id, r.version);
    await s.fail(r.id, 'kaboom');
    const got = (await s.get(r.id))!;
    expect(got.status).toBe('failed');
    expect(got.error).toBe('kaboom');
  });

  it('reset forces status back to pending', async () => {
    const s = createRequestStore('build');
    const r = await s.create('x');
    await s.claim(r.id, r.version);
    await s.reset(r.id);
    const got = (await s.get(r.id))!;
    expect(got.status).toBe('pending');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/unit/requestStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/helpers/requestStore.ts`**

```ts
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { readJsonFile, writeJsonFile } from '../storage.js';

export type RequestStatus = 'pending' | 'running' | 'done' | 'failed';

export interface FileRef {
  path: string;
  bytes: number;
}

export interface LogEntry {
  at: string;
  message: string;
}

export interface CompanionRequest {
  id: string;
  version: number;
  status: RequestStatus;
  description: string;
  createdAt: string;
  updatedAt: string;
  logs: LogEntry[];
  result: { summary: string; files: FileRef[] } | null;
  error: string | null;
}

interface FileShape {
  requests: CompanionRequest[];
}

function dataDir(): string {
  return process.env.CLAUDEPANION_DATA_DIR ?? join(process.cwd(), 'data');
}

export interface RequestStore {
  list(): Promise<CompanionRequest[]>;
  get(id: string): Promise<CompanionRequest | null>;
  create(description: string): Promise<CompanionRequest>;
  claim(id: string, expectedVersion: number): Promise<CompanionRequest>;
  log(id: string, message: string): Promise<void>;
  complete(id: string, result: { summary: string; files: FileRef[] }): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  reset(id: string): Promise<void>;
  buildRouter(): Router;
}

export function createRequestStore(slug: string): RequestStore {
  const path = () => join(dataDir(), `${slug}.json`);

  async function load(): Promise<FileShape> {
    return readJsonFile<FileShape>(path(), { requests: [] });
  }

  async function save(data: FileShape): Promise<void> {
    await writeJsonFile(path(), data);
  }

  async function update(
    id: string,
    fn: (req: CompanionRequest) => CompanionRequest,
  ): Promise<CompanionRequest> {
    const data = await load();
    const idx = data.requests.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error(`request ${id} not found`);
    const next = fn(data.requests[idx]);
    data.requests[idx] = next;
    await save(data);
    return next;
  }

  const store: RequestStore = {
    async list() {
      return (await load()).requests;
    },
    async get(id) {
      return (await load()).requests.find((r) => r.id === id) ?? null;
    },
    async create(description) {
      const now = new Date().toISOString();
      const req: CompanionRequest = {
        id: randomUUID(),
        version: 1,
        status: 'pending',
        description,
        createdAt: now,
        updatedAt: now,
        logs: [],
        result: null,
        error: null,
      };
      const data = await load();
      data.requests.push(req);
      await save(data);
      return req;
    },
    async claim(id, expectedVersion) {
      return update(id, (r) => {
        if (r.version !== expectedVersion) {
          throw new Error(
            `version conflict on ${id}: expected ${expectedVersion}, have ${r.version}`,
          );
        }
        if (r.status !== 'pending') {
          throw new Error(`cannot claim ${id}: status is ${r.status}, not pending`);
        }
        return {
          ...r,
          status: 'running',
          version: r.version + 1,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    async log(id, message) {
      await update(id, (r) => ({
        ...r,
        version: r.version + 1,
        updatedAt: new Date().toISOString(),
        logs: [...r.logs, { at: new Date().toISOString(), message }],
      }));
    },
    async complete(id, result) {
      await update(id, (r) => ({
        ...r,
        status: 'done',
        version: r.version + 1,
        updatedAt: new Date().toISOString(),
        result,
      }));
    },
    async fail(id, error) {
      await update(id, (r) => ({
        ...r,
        status: 'failed',
        version: r.version + 1,
        updatedAt: new Date().toISOString(),
        error,
      }));
    },
    async reset(id) {
      await update(id, (r) => ({
        ...r,
        status: 'pending',
        version: r.version + 1,
        updatedAt: new Date().toISOString(),
      }));
    },
    buildRouter() {
      const router = Router();
      router.post('/requests', async (req: Request, res: Response) => {
        const description = String(req.body?.description ?? '').trim();
        if (!description) {
          res.status(400).json({ error: 'description is required' });
          return;
        }
        const created = await store.create(description);
        res.status(201).json({ request: created });
      });
      router.post('/requests/:id/reset', async (req: Request, res: Response) => {
        await store.reset(req.params.id);
        res.json({ ok: true });
      });
      router.get('/requests', async (_req: Request, res: Response) => {
        res.json({ requests: await store.list() });
      });
      router.get('/requests/:id', async (req: Request, res: Response) => {
        const r = await store.get(req.params.id);
        if (!r) {
          res.status(404).json({ error: 'request not found' });
          return;
        }
        res.json({ request: r });
      });
      return router;
    },
  };

  return store;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/unit/requestStore.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/helpers/requestStore.ts tests/unit/requestStore.test.ts
git commit -m "feat: add requestStore helper for polling-pattern companions"
```

---

## Task 6: Companion discovery

**Files:**
- Create: `src/companions.ts`
- Create: `tests/unit/companions.test.ts`
- Create fixture companions during tests under a temp dir

- [ ] **Step 1: Write failing tests at `tests/unit/companions.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCompanions } from '../../src/companions.js';

function scaffold(slug: string, manifestOverrides: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cp-cmp-'));
  const dir = join(root, 'companions', slug);
  mkdirSync(join(dir, 'tools'), { recursive: true });
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify({ slug, name: slug, description: `d-${slug}`, ...manifestOverrides }),
  );
  writeFileSync(
    join(dir, 'tools', 'hello.ts'),
    `export default {
      name: 'hello',
      description: '[${slug}] say hello',
      schema: {},
      async handler() { return { content: [{ type: 'text', text: 'hi' }] }; },
    };`,
  );
  writeFileSync(
    join(dir, 'ui.ts'),
    `export async function renderPage() { return '<p>${slug}</p>'; }`,
  );
  return root;
}

describe('loadCompanions', () => {
  it('discovers a minimal companion', async () => {
    const root = scaffold('demo');
    const companions = await loadCompanions(join(root, 'companions'));
    expect(companions).toHaveLength(1);
    expect(companions[0].slug).toBe('demo');
    expect(companions[0].tools.map((t) => t.name)).toEqual(['demo_hello']);
  });

  it('rejects invalid slug in manifest', async () => {
    const root = scaffold('Bad_Slug');
    await expect(loadCompanions(join(root, 'companions'))).rejects.toThrow(/slug/i);
  });

  it('rejects duplicate slugs', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cp-cmp-'));
    const cDir = join(root, 'companions');
    for (const dir of ['a-dir', 'b-dir']) {
      const d = join(cDir, dir);
      mkdirSync(join(d, 'tools'), { recursive: true });
      writeFileSync(
        join(d, 'manifest.json'),
        JSON.stringify({ slug: 'dup', name: 'dup', description: 'x' }),
      );
      writeFileSync(
        join(d, 'ui.ts'),
        `export async function renderPage() { return ''; }`,
      );
    }
    await expect(loadCompanions(cDir)).rejects.toThrow(/duplicate/i);
  });

  it('returns empty list when companions/ is missing', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cp-cmp-'));
    const companions = await loadCompanions(join(root, 'companions'));
    expect(companions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/unit/companions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/companions.ts`**

```ts
import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import type { Companion, CompanionManifest, McpToolDefinition } from './types.js';

const SLUG_RE = /^[a-z][a-z0-9-]*$/;

async function listDirs(path: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(path, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function loadToolsDir(dir: string, slug: string): Promise<McpToolDefinition[]> {
  const toolFiles: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.js'))) {
        toolFiles.push(e.name);
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  toolFiles.sort();
  const tools: McpToolDefinition[] = [];
  for (const f of toolFiles) {
    const mod = await import(pathToFileURL(join(dir, f)).href);
    const def = (mod.default ?? mod.tool) as McpToolDefinition | undefined;
    if (!def) {
      throw new Error(`tool file ${join(dir, f)} has no default export`);
    }
    tools.push({ ...def, name: `${slug}_${def.name}` });
  }
  return tools;
}

export async function loadCompanions(companionsDir: string): Promise<Companion[]> {
  const dirs = await listDirs(companionsDir);
  const loaded: Companion[] = [];
  const seenSlugs = new Set<string>();
  for (const dirName of dirs) {
    const dir = join(companionsDir, dirName);
    const manifestPath = join(dir, 'manifest.json');
    const manifestRaw = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw) as CompanionManifest;
    if (!SLUG_RE.test(manifest.slug)) {
      throw new Error(
        `invalid slug "${manifest.slug}" in ${manifestPath} — must match ${SLUG_RE}`,
      );
    }
    if (seenSlugs.has(manifest.slug)) {
      throw new Error(`duplicate slug "${manifest.slug}" at ${manifestPath}`);
    }
    seenSlugs.add(manifest.slug);

    const tools = await loadToolsDir(join(dir, 'tools'), manifest.slug);

    const uiMod = await import(pathToFileURL(join(dir, 'ui.ts')).href).catch(async () =>
      import(pathToFileURL(join(dir, 'ui.js')).href),
    );
    const renderPage = uiMod.renderPage as Companion['renderPage'];
    if (typeof renderPage !== 'function') {
      throw new Error(`${dir}/ui.ts must export renderPage`);
    }

    let router: Companion['router'] = null;
    try {
      const routesMod = await import(pathToFileURL(join(dir, 'routes.ts')).href).catch(async () =>
        import(pathToFileURL(join(dir, 'routes.js')).href),
      );
      router = (routesMod.default ?? null) as Companion['router'];
    } catch {
      router = null;
    }

    loaded.push({
      slug: manifest.slug,
      name: manifest.name,
      description: manifest.description,
      icon: manifest.icon,
      tools,
      renderPage,
      router,
    });
  }
  return loaded;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/unit/companions.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/companions.ts tests/unit/companions.test.ts
git commit -m "feat: add companion discovery with slug validation"
```

---

## Task 7: MCP mount refactor

**Files:**
- Create: `src/mcp.ts` (replaces `src/mcp/server.ts`, consolidates `src/mcp/types.ts` logic — older file stays until Task 16 strip)
- Create: `tests/integration/mcp.test.ts`

- [ ] **Step 1: Write failing integration test at `tests/integration/mcp.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { mountMcp } from '../../src/mcp.js';
import type { Companion } from '../../src/types.js';
import { createBroadcaster } from '../../src/broadcast.js';
import { z } from 'zod';

function makeCompanion(): Companion {
  return {
    slug: 'demo',
    name: 'Demo',
    description: 'd',
    tools: [
      {
        name: 'demo_ping',
        description: '[demo] ping',
        schema: { msg: z.string() },
        async handler(params) {
          return { content: [{ type: 'text', text: `pong:${(params as { msg: string }).msg}` }] };
        },
      },
    ],
    renderPage: () => '',
    router: null,
  };
}

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  const app = express();
  app.use(express.json());
  const broadcaster = createBroadcaster();
  mountMcp(app, broadcaster, [makeCompanion()]);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(() => {
  server.close();
});

describe('MCP mount', () => {
  it('initialize returns a session id and lists companion tool', async () => {
    const initRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '0' },
        },
      }),
    });
    expect(initRes.status).toBe(200);
    const sid = initRes.headers.get('mcp-session-id');
    expect(sid).toBeTruthy();

    const listRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-session-id': sid!,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    });
    const listText = await listRes.text();
    // Response may be JSON or SSE framed; look for tool name either way.
    expect(listText).toMatch(/demo_ping/);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/integration/mcp.test.ts`
Expected: FAIL — `../../src/mcp.js` not found.

- [ ] **Step 3: Implement `src/mcp.ts`**

```ts
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Express, Request, Response } from 'express';
import type { Broadcaster } from './broadcast.js';
import type { Companion, CompanionContext } from './types.js';
import { createRequestStore } from './helpers/requestStore.js';

export function createMcpServer(companions: Companion[], broadcaster: Broadcaster): McpServer {
  const server = new McpServer({ name: 'claudepanion', version: '0.3.0' });
  for (const companion of companions) {
    const ctx: CompanionContext = {
      slug: companion.slug,
      broadcast: broadcaster.broadcast,
      store: createRequestStore(companion.slug) as unknown as CompanionContext['store'],
      log: (...args) => console.error(`[${companion.slug}]`, ...args),
    };
    for (const tool of companion.tools) {
      server.tool(
        tool.name,
        tool.description,
        tool.schema,
        async (params) => tool.handler(params as Record<string, unknown>, ctx),
      );
    }
  }
  return server;
}

export function mountMcp(
  app: Express,
  broadcaster: Broadcaster,
  companions: Companion[],
): void {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.all('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.header('mcp-session-id');

    if (req.method === 'POST') {
      const body = req.body;
      const isInit = Array.isArray(body)
        ? body.some((m: { method?: string }) => m?.method === 'initialize')
        : body?.method === 'initialize';

      if (isInit) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });
        transport.onclose = () => {
          if (transport.sessionId) transports.delete(transport.sessionId);
        };
        transport.onerror = (err) => console.error('[mcp] transport error:', err);
        const server = createMcpServer(companions, broadcaster);
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
        if (transport.sessionId) transports.set(transport.sessionId, transport);
        return;
      }

      if (!sessionId || !transports.has(sessionId)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: no valid session id' },
          id: null,
        });
        return;
      }
      await transports.get(sessionId)!.handleRequest(req, res, body);
      return;
    }

    if (req.method === 'GET' || req.method === 'DELETE') {
      if (!sessionId || !transports.has(sessionId)) {
        res.status(400).json({ error: 'Invalid or missing session ID' });
        return;
      }
      await transports.get(sessionId)!.handleRequest(req, res);
      if (req.method === 'DELETE') transports.delete(sessionId);
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  });
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/integration/mcp.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/mcp.ts tests/integration/mcp.test.ts
git commit -m "feat: refactor MCP mount to accept companion list"
```

---

## Task 8: Build companion — manifest + store + routes

**Files:**
- Create: `companions/build/manifest.json`
- Create: `companions/build/store.ts`
- Create: `companions/build/routes.ts`
- Create: `tests/unit/build-store.test.ts`

- [ ] **Step 1: Write `companions/build/manifest.json`**

```json
{
  "slug": "build",
  "name": "Build",
  "description": "Scaffold new claudepanion companions from a plain-English prompt. Claude Code picks up pending requests via MCP and writes companion files to disk.",
  "icon": "✦"
}
```

- [ ] **Step 2: Write `companions/build/store.ts`**

```ts
import { createRequestStore } from '../../src/helpers/requestStore.js';

export const store = createRequestStore('build');
```

- [ ] **Step 3: Write `companions/build/routes.ts`**

```ts
import { store } from './store.js';

export default store.buildRouter();
```

- [ ] **Step 4: Write a sanity test at `tests/unit/build-store.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { store } from '../../companions/build/store.js';

describe('build companion store', () => {
  beforeEach(() => {
    process.env.CLAUDEPANION_DATA_DIR = mkdtempSync(join(tmpdir(), 'build-s-'));
  });

  it('round-trips a request', async () => {
    const r = await store.create('scaffold a notes companion');
    const back = await store.get(r.id);
    expect(back?.description).toBe('scaffold a notes companion');
  });
});
```

- [ ] **Step 5: Run test**

Run: `npm test -- tests/unit/build-store.test.ts`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add companions/build/manifest.json companions/build/store.ts companions/build/routes.ts tests/unit/build-store.test.ts
git commit -m "feat(build): add Build companion manifest, store, and routes"
```

---

## Task 9: Build companion — MCP tools

**Files:**
- Create: `companions/build/tools/list.ts`
- Create: `companions/build/tools/claim.ts`
- Create: `companions/build/tools/log.ts`
- Create: `companions/build/tools/complete.ts`
- Create: `tests/unit/build-tools.test.ts`

- [ ] **Step 1: Write `companions/build/tools/list.ts`**

```ts
import type { McpToolDefinition } from '../../../src/types.js';
import { successResult } from '../../../src/types.js';
import { store } from '../store.js';

const tool: McpToolDefinition<Record<string, never>> = {
  name: 'list',
  description: '[build] List pending / running / completed build requests.',
  schema: {},
  async handler() {
    return successResult({ requests: await store.list() });
  },
};

export default tool;
```

- [ ] **Step 2: Write `companions/build/tools/claim.ts`**

```ts
import { z } from 'zod';
import type { McpToolDefinition } from '../../../src/types.js';
import { successResult, errorResult } from '../../../src/types.js';
import { store } from '../store.js';

const tool: McpToolDefinition<{ id: string; expectedVersion: number }> = {
  name: 'claim',
  description: '[build] Claim a pending build request. Moves status → running. Pass the current version of the request; returns conflict if version is stale.',
  schema: {
    id: z.string().describe('Request id to claim'),
    expectedVersion: z.number().int().describe('Current version of the request (from list)'),
  },
  async handler({ id, expectedVersion }, ctx) {
    try {
      const claimed = await store.claim(id, expectedVersion);
      ctx.broadcast('build.request_updated', { request: claimed });
      return successResult({ request: claimed });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
};

export default tool;
```

- [ ] **Step 3: Write `companions/build/tools/log.ts`**

```ts
import { z } from 'zod';
import type { McpToolDefinition } from '../../../src/types.js';
import { successResult, errorResult } from '../../../src/types.js';
import { store } from '../store.js';

const tool: McpToolDefinition<{ id: string; message: string }> = {
  name: 'log',
  description: '[build] Append a progress line to a running build. Streams live to the UI.',
  schema: {
    id: z.string().describe('Request id'),
    message: z.string().describe('One-line progress update'),
  },
  async handler({ id, message }, ctx) {
    try {
      await store.log(id, message);
      ctx.broadcast('build.log_appended', { id, message, at: new Date().toISOString() });
      return successResult({ ok: true });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
};

export default tool;
```

- [ ] **Step 4: Write `companions/build/tools/complete.ts`**

```ts
import { z } from 'zod';
import { promises as fs } from 'node:fs';
import { dirname, join, normalize, relative, resolve, sep } from 'node:path';
import type { McpToolDefinition } from '../../../src/types.js';
import { successResult, errorResult } from '../../../src/types.js';
import { store } from '../store.js';

const FileSchema = z.object({
  path: z.string().describe('Repo-relative path, must be under companions/<slug>/ or skills/<slug>/'),
  content: z.string().describe('Full file contents'),
});

function validatePath(relPath: string, repoRoot: string): string {
  const absRepoRoot = resolve(repoRoot);
  const absTarget = resolve(absRepoRoot, relPath);
  const rel = relative(absRepoRoot, absTarget);
  if (rel.startsWith('..') || resolve(absRepoRoot, rel) !== absTarget) {
    throw new Error(`path escapes repo root: ${relPath}`);
  }
  const normRel = normalize(rel).split(sep);
  const allowedRoots = ['companions', 'skills'];
  if (!allowedRoots.includes(normRel[0])) {
    throw new Error(`path not under companions/ or skills/: ${relPath}`);
  }
  return absTarget;
}

const tool: McpToolDefinition<{
  id: string;
  files?: Array<{ path: string; content: string }>;
  summary?: string;
  error?: string;
}> = {
  name: 'complete',
  description: '[build] Finish a build. On success, writes scaffolded files atomically and renders a markdown summary. On failure, pass {error} instead of {files,summary}.',
  schema: {
    id: z.string(),
    files: z.array(FileSchema).optional(),
    summary: z.string().optional(),
    error: z.string().optional(),
  },
  async handler({ id, files, summary, error }, ctx) {
    if (error) {
      await store.fail(id, error);
      ctx.broadcast('build.request_updated', { id });
      return successResult({ ok: true });
    }
    if (!files || !summary) {
      await store.fail(id, 'complete called without files+summary or error');
      ctx.broadcast('build.request_updated', { id });
      return errorResult('must provide files+summary or error');
    }

    const repoRoot = process.env.CLAUDEPANION_REPO_ROOT ?? process.cwd();
    const stagingRoot = join(repoRoot, `.claudepanion-stage-${id}`);

    try {
      const fileRefs: Array<{ path: string; bytes: number }> = [];
      for (const f of files) {
        const absTarget = validatePath(f.path, repoRoot);
        const stagedPath = join(stagingRoot, relative(repoRoot, absTarget));
        await fs.mkdir(dirname(stagedPath), { recursive: true });
        await fs.writeFile(stagedPath, f.content);
        // collision check: if destination exists, reject
        try {
          await fs.access(absTarget);
          throw new Error(`file already exists at ${f.path}`);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        }
        fileRefs.push({ path: f.path, bytes: Buffer.byteLength(f.content) });
      }

      // move each staged file into place
      for (const f of files) {
        const absTarget = validatePath(f.path, repoRoot);
        const stagedPath = join(stagingRoot, relative(repoRoot, absTarget));
        await fs.mkdir(dirname(absTarget), { recursive: true });
        await fs.rename(stagedPath, absTarget);
      }
      await fs.rm(stagingRoot, { recursive: true, force: true });

      await store.complete(id, { summary, files: fileRefs });
      ctx.broadcast('build.request_updated', { id });
      return successResult({ ok: true, files: fileRefs });
    } catch (err) {
      await fs.rm(stagingRoot, { recursive: true, force: true }).catch(() => {});
      await store.fail(id, (err as Error).message);
      ctx.broadcast('build.request_updated', { id });
      return errorResult((err as Error).message);
    }
  },
};

export default tool;
```

- [ ] **Step 5: Write tool tests at `tests/unit/build-tools.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import list from '../../companions/build/tools/list.js';
import claim from '../../companions/build/tools/claim.js';
import log from '../../companions/build/tools/log.js';
import complete from '../../companions/build/tools/complete.js';
import { store } from '../../companions/build/store.js';

function ctx() {
  const events: Array<{ event: string; data: unknown }> = [];
  return {
    slug: 'build',
    broadcast: (event: string, data: unknown) => events.push({ event, data }),
    store: {} as never,
    log: () => {},
    events,
  };
}

beforeEach(() => {
  process.env.CLAUDEPANION_DATA_DIR = mkdtempSync(join(tmpdir(), 'bt-data-'));
  process.env.CLAUDEPANION_REPO_ROOT = mkdtempSync(join(tmpdir(), 'bt-repo-'));
});

describe('build tools', () => {
  it('list returns empty initially', async () => {
    const res = await list.handler({}, ctx());
    expect(res.content[0].text).toMatch(/"requests": \[\]/);
  });

  it('claim → log → complete writes files and broadcasts', async () => {
    const req = await store.create('scaffold foo');
    const c = ctx();

    const claimed = await claim.handler({ id: req.id, expectedVersion: req.version }, c);
    expect(claimed.isError).toBeFalsy();
    expect(c.events.find((e) => e.event === 'build.request_updated')).toBeTruthy();

    await log.handler({ id: req.id, message: 'writing manifest' }, c);
    expect(c.events.find((e) => e.event === 'build.log_appended')).toBeTruthy();

    const completed = await complete.handler(
      {
        id: req.id,
        summary: '# Scaffolded `foo`',
        files: [
          { path: 'companions/foo/manifest.json', content: '{"slug":"foo","name":"Foo","description":"d"}' },
          { path: 'skills/foo/SKILL.md', content: '---\nname: foo\n---\n# foo' },
        ],
      },
      c,
    );
    expect(completed.isError).toBeFalsy();

    const repoRoot = process.env.CLAUDEPANION_REPO_ROOT!;
    expect(existsSync(join(repoRoot, 'companions/foo/manifest.json'))).toBe(true);
    expect(existsSync(join(repoRoot, 'skills/foo/SKILL.md'))).toBe(true);

    const got = await store.get(req.id);
    expect(got?.status).toBe('done');
    expect(got?.result?.files).toHaveLength(2);
  });

  it('complete rejects path traversal', async () => {
    const req = await store.create('evil');
    await claim.handler({ id: req.id, expectedVersion: req.version }, ctx());
    const res = await complete.handler(
      {
        id: req.id,
        summary: 'x',
        files: [{ path: '../../../etc/pwn', content: 'boom' }],
      },
      ctx(),
    );
    expect(res.isError).toBe(true);
    const got = await store.get(req.id);
    expect(got?.status).toBe('failed');
  });

  it('complete rejects writes outside companions/ and skills/', async () => {
    const req = await store.create('x');
    await claim.handler({ id: req.id, expectedVersion: req.version }, ctx());
    const res = await complete.handler(
      {
        id: req.id,
        summary: 'x',
        files: [{ path: 'src/evil.ts', content: 'boom' }],
      },
      ctx(),
    );
    expect(res.isError).toBe(true);
  });

  it('complete with {error} marks failed without writing files', async () => {
    const req = await store.create('x');
    await claim.handler({ id: req.id, expectedVersion: req.version }, ctx());
    const res = await complete.handler({ id: req.id, error: 'it broke' }, ctx());
    expect(res.isError).toBeFalsy();
    const got = await store.get(req.id);
    expect(got?.status).toBe('failed');
    expect(got?.error).toBe('it broke');
  });
});
```

- [ ] **Step 6: Run tests**

Run: `npm test -- tests/unit/build-tools.test.ts`
Expected: 5 passed.

- [ ] **Step 7: Commit**

```bash
git add companions/build/tools tests/unit/build-tools.test.ts
git commit -m "feat(build): add list, claim, log, complete MCP tools with path safety"
```

---

## Task 10: Build companion — UI

**Files:**
- Create: `companions/build/ui.ts`
- Create: `tests/unit/build-ui.test.ts`

- [ ] **Step 1: Write failing test at `tests/unit/build-ui.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderPage } from '../../companions/build/ui.js';
import { store } from '../../companions/build/store.js';

beforeEach(() => {
  process.env.CLAUDEPANION_DATA_DIR = mkdtempSync(join(tmpdir(), 'bu-'));
});

describe('build ui', () => {
  it('renders an empty state with a textbox', async () => {
    const html = await renderPage({
      slug: 'build',
      broadcast: () => {},
      store: {} as never,
      log: () => {},
    });
    expect(html).toMatch(/<form/);
    expect(html).toMatch(/textarea/);
    expect(html).toMatch(/No requests yet/i);
  });

  it('lists existing requests with status badges', async () => {
    await store.create('scaffold a notes companion');
    const html = await renderPage({
      slug: 'build',
      broadcast: () => {},
      store: {} as never,
      log: () => {},
    });
    expect(html).toMatch(/scaffold a notes companion/);
    expect(html).toMatch(/pending/);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/unit/build-ui.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `companions/build/ui.ts`**

```ts
import type { CompanionContext } from '../../src/types.js';
import { store } from './store.js';

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusBadge(status: string): string {
  return `<span class="badge badge-${status}">${status}</span>`;
}

function renderRequest(r: {
  id: string;
  status: string;
  description: string;
  createdAt: string;
  logs: Array<{ at: string; message: string }>;
  result: { summary: string; files: Array<{ path: string; bytes: number }> } | null;
  error: string | null;
}): string {
  const logs = r.logs
    .map((l) => `<div class="log-line"><span class="log-at">${escape(l.at)}</span> ${escape(l.message)}</div>`)
    .join('');
  const files = r.result?.files
    ? `<details><summary>Files (${r.result.files.length})</summary><ul>${r.result.files
        .map((f) => `<li><code>${escape(f.path)}</code> <span class="dim">(${f.bytes}b)</span></li>`)
        .join('')}</ul></details>`
    : '';
  const summary = r.result?.summary
    ? `<div class="md">${escape(r.result.summary).replace(/\n/g, '<br/>')}</div>`
    : '';
  const err = r.error ? `<div class="error">${escape(r.error)}</div>` : '';
  return `
    <article class="request" data-id="${escape(r.id)}" data-status="${escape(r.status)}">
      <header>${statusBadge(r.status)} <span class="dim">${escape(r.createdAt)}</span></header>
      <p class="desc">${escape(r.description)}</p>
      <div class="logs">${logs}</div>
      ${summary}
      ${files}
      ${err}
    </article>
  `;
}

export async function renderPage(_ctx: CompanionContext): Promise<string> {
  const requests = await store.list();
  const sorted = [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const listHtml = sorted.length
    ? sorted.map(renderRequest).join('')
    : `<p class="empty">No requests yet. Describe a companion to scaffold and Claude Code will pick it up.</p>`;

  return `
    <section class="build-page">
      <h1>Build</h1>
      <p class="intro">Claudepanion works by having Claude Code (in this repo) pick up work you submit here. Make sure a Claude Code session is running with claudepanion enabled.</p>
      <form id="build-form">
        <label for="desc">Describe a companion to scaffold</label>
        <textarea id="desc" name="description" rows="4" placeholder="A companion that reads a URL and produces a markdown summary."></textarea>
        <button type="submit" class="btn-primary">Submit</button>
      </form>
      <h2>Requests</h2>
      <div id="build-list">${listHtml}</div>
    </section>
    <script>
      (function () {
        const form = document.getElementById('build-form');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const desc = document.getElementById('desc').value.trim();
          if (!desc) return;
          await api('POST', '/api/c/build/requests', { description: desc });
          document.getElementById('desc').value = '';
          showToast('Request submitted');
        });
        sse.addEventListener('build.request_created', () => location.reload());
        sse.addEventListener('build.request_updated', () => location.reload());
        sse.addEventListener('build.log_appended', (e) => {
          const { id, message, at } = JSON.parse(e.data);
          const card = document.querySelector('article.request[data-id="' + id + '"] .logs');
          if (card) {
            const el = document.createElement('div');
            el.className = 'log-line';
            el.innerHTML = '<span class="log-at"></span> <span class="msg"></span>';
            el.querySelector('.log-at').textContent = at;
            el.querySelector('.msg').textContent = message;
            card.appendChild(el);
          }
        });
      })();
    </script>
  `;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/unit/build-ui.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add companions/build/ui.ts tests/unit/build-ui.test.ts
git commit -m "feat(build): add server-rendered UI with SSE live updates"
```

---

## Task 11: Platform skills

**Files:**
- Create: `skills/use-claudepanion/SKILL.md`
- Create: `skills/build/SKILL.md`

- [ ] **Step 1: Write `skills/use-claudepanion/SKILL.md`**

```markdown
---
name: use-claudepanion
description: Always-on meta-skill for the claudepanion plugin — explains the companion pattern and directs Claude to check pending work via MCP when working in the claudepanion repo.
---

# Use Claudepanion

When the `claudepanion` MCP server is connected, it exposes tools from one or more **companions** — small web apps whose work Claude Code performs on behalf of the user. Each companion owns a tool group, all prefixed with the companion's slug:

- `<slug>_list` — pending / running / completed work items
- `<slug>_claim` — move a pending item to running (requires current version)
- `<slug>_log` — append a live progress line (streams to UI)
- `<slug>_complete` — finish the work, produce an artifact

## When you're working in the claudepanion repo

1. At session start, consider calling `build_list` (and any other companion's `_list`) to see if the user has submitted pending work through the UI.
2. When you claim work, stream progress with `<slug>_log` — the user is watching the browser.
3. Each companion has its own `SKILL.md` at `skills/<slug>/SKILL.md` — **read it when you're engaged with that companion's work**. It describes the companion's expected behavior and any domain-specific constraints.

## When you're working in a different repo that has claudepanion installed

You'll see the same tools, but submitting / watching requests happens in the browser UI served by the user's claudepanion server. Treat the tools the same way.

## Boundaries

- Every companion tool writes data under `data/<slug>.json` via the request-store helper. Don't attempt direct disk writes to `data/` from outside a tool handler.
- File-writing tools (e.g. `build_complete`) only allow paths under `companions/<slug>/` and `skills/<slug>/`. This is enforced server-side; don't try to bypass.
- If you're unsure whether to claim a request, ask the user first — the request author may not have finalized their intent.
```

- [ ] **Step 2: Write `skills/build/SKILL.md`**

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add skills/use-claudepanion skills/build
git commit -m "docs(skills): add use-claudepanion meta-skill and build skill"
```

---

## Task 12: Server refactor — companion-based routing

**Files:**
- Modify: `src/server.ts` (full rewrite)
- Create: `src/ui/layout.ts` updates (see Task 13; server.ts imports remain stable)

- [ ] **Step 1: Rewrite `src/server.ts`**

```ts
import { join } from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import { loadCompanions } from './companions.js';
import { createBroadcaster } from './broadcast.js';
import { mountMcp } from './mcp.js';
import { createRequestStore } from './helpers/requestStore.js';
import { layout } from './ui/layout.js';
import type { Companion, CompanionContext } from './types.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const repoRoot = process.env.CLAUDEPANION_REPO_ROOT ?? process.cwd();
const companionsDir = process.env.CLAUDEPANION_COMPANIONS_DIR ?? join(repoRoot, 'companions');

app.use(express.json());

// ── UI broadcast (SSE stream for browsers) ────────────────────────────
const broadcaster = createBroadcaster();

interface SseClient {
  sendEvent: (event: string, data: unknown) => void;
}

const sseClients = new Map<number, SseClient>();
let sseClientId = 0;

broadcaster.subscribe((event, data) => {
  for (const client of sseClients.values()) {
    try { client.sendEvent(event, data); } catch { /* closed */ }
  }
});

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const id = ++sseClientId;
  sseClients.set(id, {
    sendEvent(event, data) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id })}\n\n`);

  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(id);
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, companions: companions.map((c) => c.slug) });
});

// ── Load companions and mount everything ──────────────────────────────
let companions: Companion[] = [];

async function boot(): Promise<void> {
  companions = await loadCompanions(companionsDir);
  console.log(`[claudepanion] loaded ${companions.length} companion(s): ${companions.map((c) => c.slug).join(', ')}`);

  mountMcp(app, broadcaster, companions);

  for (const c of companions) {
    if (c.router) {
      app.use(`/api/c/${c.slug}`, c.router);
    }
    app.get(`/c/${c.slug}`, async (_req: Request, res: Response) => {
      const ctx: CompanionContext = {
        slug: c.slug,
        broadcast: broadcaster.broadcast,
        store: createRequestStore(c.slug) as unknown as CompanionContext['store'],
        log: (...args) => console.error(`[${c.slug}]`, ...args),
      };
      const body = await c.renderPage(ctx);
      res.type('html').send(layout(c.name, c.slug, body, companions));
    });
  }

  app.get('/', (_req, res) => {
    if (companions.length === 0) {
      res.type('html').send(layout('No companions', '', '<p>No companions installed. Add one under <code>companions/</code>.</p>', []));
      return;
    }
    res.redirect(`/c/${companions[0].slug}`);
  });

  app.listen(port, () => {
    console.log(`\n  claudepanion running at http://localhost:${port}`);
    console.log(`  MCP endpoint:   http://localhost:${port}/mcp`);
    console.log(`  Events stream:  http://localhost:${port}/events\n`);
  });
}

boot().catch((err) => {
  console.error('[claudepanion] failed to start:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Update `tsconfig.json` if needed**

Ensure `module: "NodeNext"` and `moduleResolution: "NodeNext"` so `.js` ESM imports work for `.ts` source. If the current tsconfig already has this, skip.

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "refactor: rewrite server to load companions and mount them dynamically"
```

---

## Task 13: Layout refactor — companion nav

**Files:**
- Modify: `src/ui/layout.ts` (signature change: accept companion list)

- [ ] **Step 1: Rewrite `src/ui/layout.ts`**

```ts
import type { Companion } from '../types.js';

const DEV_MODE = process.env.NODE_ENV !== 'production';

export function layout(
  title: string,
  activeSlug: string,
  body: string,
  companions: Companion[],
): string {
  const navItems = companions
    .map((c) => {
      const active = c.slug === activeSlug ? 'active' : '';
      const icon = c.icon ?? '•';
      return `<a href="/c/${c.slug}" class="${active}"><span class="nav-icon">${icon}</span>${c.name}</a>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Claudepanion</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0f1117; --surface: #1a1d27; --surface2: #22263a;
      --border: #2e3250; --accent: #7c6af7; --accent-dim: #4b44a8;
      --text: #e8eaf6; --text-dim: #8890b0;
      --pending: #3b82f6; --running: #f59e0b; --done: #22c55e; --failed: #ef4444;
      --radius: 10px; --nav-w: 220px;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: var(--bg); color: var(--text); display: flex; min-height: 100vh; }
    nav { width: var(--nav-w); min-height: 100vh; background: var(--surface);
          border-right: 1px solid var(--border); display: flex; flex-direction: column;
          padding: 1.5rem 0; position: fixed; top: 0; left: 0; }
    .nav-logo { padding: 0 1.25rem 1.5rem; font-size: 1.1rem; font-weight: 700;
                color: var(--accent); letter-spacing: -0.02em;
                border-bottom: 1px solid var(--border); margin-bottom: 1rem; }
    .nav-logo span { color: var(--text-dim); font-weight: 400; }
    nav a { display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 1.25rem;
            color: var(--text-dim); text-decoration: none; font-size: 0.95rem;
            border-radius: var(--radius); margin: 0.1rem 0.5rem;
            transition: background 0.15s, color 0.15s; }
    nav a:hover { background: var(--surface2); color: var(--text); }
    nav a.active { background: var(--accent-dim); color: #fff; font-weight: 600; }
    .nav-icon { width: 1rem; text-align: center; }
    .nav-footer { margin-top: auto; padding: 1rem 1.25rem 0;
                  border-top: 1px solid var(--border); font-size: 0.78rem;
                  color: var(--text-dim); line-height: 1.6; }
    .nav-footer code { background: var(--surface2); padding: 0.1rem 0.35rem;
                       border-radius: 4px; font-size: 0.74rem; }
    main { margin-left: var(--nav-w); flex: 1; padding: 2rem; max-width: 1400px; }
    h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: 1rem; }
    h2 { font-size: 1.1rem; font-weight: 600; margin: 1.5rem 0 0.75rem; }
    textarea, input { font: inherit; background: var(--surface2); border: 1px solid var(--border);
                     color: var(--text); border-radius: 6px; padding: 0.55rem 0.8rem;
                     width: 100%; outline: none; }
    textarea { resize: vertical; min-height: 80px; }
    button { font: inherit; cursor: pointer; border: none; border-radius: 6px;
             padding: 0.55rem 1.1rem; font-weight: 600; transition: opacity 0.15s; }
    button:hover { opacity: 0.85; }
    .btn-primary { background: var(--accent); color: #fff; }
    .badge { display: inline-block; border-radius: 999px; font-size: 0.72rem;
             font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
             padding: 0.2rem 0.6rem; }
    .badge-pending  { background: rgba(59,130,246,0.18); color: var(--pending); }
    .badge-running  { background: rgba(245,158,11,0.18); color: var(--running); }
    .badge-done     { background: rgba(34,197,94,0.18); color: var(--done); }
    .badge-failed   { background: rgba(239,68,68,0.18); color: var(--failed); }
    .request { background: var(--surface); border: 1px solid var(--border);
               border-radius: var(--radius); padding: 1rem; margin-bottom: 0.8rem; }
    .request header { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }
    .desc { font-weight: 600; margin-bottom: 0.5rem; }
    .logs { font-family: 'SF Mono', Menlo, monospace; font-size: 0.82rem;
            color: var(--text-dim); background: var(--surface2);
            border-radius: 6px; padding: 0.5rem; margin: 0.5rem 0; }
    .log-line { margin: 0.15rem 0; }
    .log-at { color: var(--accent-dim); margin-right: 0.5rem; }
    .md { font-size: 0.95rem; line-height: 1.6; margin-top: 0.5rem; }
    .error { color: var(--failed); margin-top: 0.5rem; }
    .empty { color: var(--text-dim); font-style: italic; }
    .dim { color: var(--text-dim); }
    .intro { color: var(--text-dim); font-size: 0.88rem; margin-bottom: 1rem; }
    form label { display: block; font-size: 0.88rem; color: var(--text-dim); margin-bottom: 0.3rem; }
    form { margin-bottom: 2rem; }
    form button { margin-top: 0.6rem; }
    #toast { position: fixed; bottom: 1.5rem; right: 1.5rem; background: var(--surface2);
             border: 1px solid var(--border); color: var(--text); border-radius: var(--radius);
             padding: 0.75rem 1.25rem; font-size: 0.9rem; opacity: 0; transition: opacity 0.25s;
             pointer-events: none; z-index: 999; }
    #toast.show { opacity: 1; }
  </style>
</head>
<body>
  <nav>
    <div class="nav-logo">Claude<span>panion</span></div>
    ${navItems || '<p class="empty" style="padding:0 1.25rem">No companions.</p>'}
    <div class="nav-footer">
      MCP endpoint<br/><code>/mcp</code><br/>
      Event stream<br/><code>GET /events</code>
      ${DEV_MODE ? '<br/><span style="color:var(--running)">DEV MODE</span>' : ''}
    </div>
  </nav>
  <main>${body}</main>
  <div id="toast"></div>
  <script>
    const sse = new EventSource('/events');
    function showToast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 2500);
    }
    async function api(method, path, body) {
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (body !== undefined) opts.body = JSON.stringify(body);
      const res = await fetch(path, opts);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast('Error: ' + (json.error ?? res.statusText));
        throw new Error(json.error ?? res.statusText);
      }
      return json;
    }
  </script>
</body>
</html>`;
}
```

- [ ] **Step 2: Smoke-test by starting the dev server**

Run: `npx tsx src/server.ts`
Expected:
```
[claudepanion] loaded 1 companion(s): build
claudepanion running at http://localhost:3000
```

Open `http://localhost:3000` in a browser. Expect redirect to `/c/build`, Build's page rendered with sidebar listing "Build", the form visible.

Stop the server (Ctrl-C).

- [ ] **Step 3: Commit**

```bash
git add src/ui/layout.ts
git commit -m "refactor: layout accepts companion list and renders dynamic nav"
```

---

## Task 14: Strip tasks + skills legacy code

**Files:**
- Delete: `src/store.ts`
- Delete: `src/mcp/server.ts`, `src/mcp/types.ts`, `src/mcp/tools/` (entire directory)
- Delete: `src/ui/tasksPage.ts`, `src/ui/skillsPage.ts`
- Delete: `skills/use-claude-manager-mcp/` (full dir)
- Clean up any remaining references

- [ ] **Step 1: Delete legacy source files**

```bash
rm -rf src/mcp src/store.ts src/ui/tasksPage.ts src/ui/skillsPage.ts
```

- [ ] **Step 2: Delete legacy skill directory**

```bash
rm -rf skills/use-claude-manager-mcp
```

- [ ] **Step 3: Verify nothing imports the deleted modules**

Run: `npm run check`
Expected: clean typecheck. If errors, they point at stale imports — fix by removing the import statements.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests pass. If any imports reference deleted paths, remove them.

- [ ] **Step 5: Start the dev server and verify**

Run: `npx tsx src/server.ts`
Expected: server boots, `/c/build` renders, Build form works (submit a test request, see it appear with "pending" badge).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove legacy tasks and skills code (superseded by companions)"
```

---

## Task 15: Integration test — Build end-to-end

**Files:**
- Create: `tests/integration/build-e2e.test.ts`

- [ ] **Step 1: Write the integration test**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCompanions } from '../../src/companions.js';
import { createBroadcaster } from '../../src/broadcast.js';
import { mountMcp } from '../../src/mcp.js';

let server: Server;
let baseUrl: string;
let dataDir: string;
let repoRoot: string;

async function initSession(): Promise<string> {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } },
    }),
  });
  return res.headers.get('mcp-session-id')!;
}

async function callTool(sid: string, name: string, args: unknown, id: number): Promise<string> {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-session-id': sid },
    body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }),
  });
  return res.text();
}

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'e2e-data-'));
  repoRoot = mkdtempSync(join(tmpdir(), 'e2e-repo-'));
  process.env.CLAUDEPANION_DATA_DIR = dataDir;
  process.env.CLAUDEPANION_REPO_ROOT = repoRoot;

  const app = express();
  app.use(express.json());
  const broadcaster = createBroadcaster();
  const companions = await loadCompanions(join(process.cwd(), 'companions'));
  mountMcp(app, broadcaster, companions);
  for (const c of companions) {
    if (c.router) app.use(`/api/c/${c.slug}`, c.router);
  }
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => {
  server.close();
});

describe('Build end-to-end', () => {
  it('POST create → MCP claim → log → complete writes scaffolded files', async () => {
    // 1. UI submits a build request
    const createRes = await fetch(`${baseUrl}/api/c/build/requests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'scaffold a notes companion' }),
    });
    expect(createRes.status).toBe(201);
    const { request: req } = await createRes.json();
    expect(req.status).toBe('pending');

    // 2. Claude initializes MCP session, lists, claims
    const sid = await initSession();
    const listOut = await callTool(sid, 'build_list', {}, 2);
    expect(listOut).toMatch(req.id);

    const claimOut = await callTool(sid, 'build_claim', { id: req.id, expectedVersion: req.version }, 3);
    expect(claimOut).not.toMatch(/isError.*true/);

    // 3. Claude logs progress
    await callTool(sid, 'build_log', { id: req.id, message: 'writing manifest' }, 4);

    // 4. Claude completes with files
    const completeOut = await callTool(sid, 'build_complete', {
      id: req.id,
      summary: '# Scaffolded `notes`',
      files: [
        { path: 'companions/notes/manifest.json', content: '{"slug":"notes","name":"Notes","description":"A notes companion"}' },
        { path: 'skills/notes/SKILL.md', content: '---\nname: notes\n---\n# Notes' },
      ],
    }, 5);
    expect(completeOut).not.toMatch(/isError.*true/);

    // 5. Files landed at scaffolded paths
    const manifestPath = join(repoRoot, 'companions/notes/manifest.json');
    const skillPath = join(repoRoot, 'skills/notes/SKILL.md');
    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(skillPath)).toBe(true);
    expect(JSON.parse(readFileSync(manifestPath, 'utf8'))).toMatchObject({ slug: 'notes' });

    // 6. data/build.json has the done request
    const buildData = JSON.parse(readFileSync(join(dataDir, 'build.json'), 'utf8'));
    expect(buildData.requests[0].status).toBe('done');
    expect(buildData.requests[0].result.files).toHaveLength(2);
  });

  it('UI reset endpoint unsticks a stuck running request', async () => {
    const createRes = await fetch(`${baseUrl}/api/c/build/requests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'x' }),
    });
    const { request: req } = await createRes.json();

    const sid = await initSession();
    await callTool(sid, 'build_claim', { id: req.id, expectedVersion: req.version }, 2);

    const resetRes = await fetch(`${baseUrl}/api/c/build/requests/${req.id}/reset`, {
      method: 'POST',
    });
    expect(resetRes.status).toBe(200);

    const buildData = JSON.parse(readFileSync(join(dataDir, 'build.json'), 'utf8'));
    expect(buildData.requests[0].status).toBe('pending');
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npm test -- tests/integration/build-e2e.test.ts`
Expected: 2 passed. If the test can't load `companions/` from `process.cwd()`, confirm tests run from repo root.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/build-e2e.test.ts
git commit -m "test: add Build end-to-end integration test"
```

---

## Task 16: CLI binary — dev / serve / plugin install / uninstall

**Files:**
- Create: `bin/claudepanion` (replaces `bin/claude-manager` — delete the old one in Task 17)
- Modify: `package.json` `bin` field

- [ ] **Step 1: Read the existing `bin/claude-manager` for reference**

Read the file to understand the existing plugin install/uninstall logic, port handling, and process setup. Retain the logic; rename identifiers.

- [ ] **Step 2: Write `bin/claudepanion`**

```js
#!/usr/bin/env node
// Entry point for the claudepanion CLI.
// Commands:
//   claudepanion serve                start server (tsx runtime)
//   claudepanion dev                  start server with watch mode
//   claudepanion plugin install       register plugin in current repo's .claude/settings.local.json
//   claudepanion plugin uninstall     remove plugin from current repo's settings
//   claudepanion help

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function runTsx(args, extraEnv = {}) {
  const tsxBin = join(repoRoot, 'node_modules/.bin/tsx');
  const child = spawn(tsxBin, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

function serve() {
  runTsx(['src/server.ts']);
}

function dev() {
  runTsx(['watch', 'src/server.ts'], { NODE_ENV: 'development' });
}

function pluginInstall() {
  const cwd = process.cwd();
  const settingsDir = join(cwd, '.claude');
  const settingsPath = join(settingsDir, 'settings.local.json');
  mkdirSync(settingsDir, { recursive: true });
  const existing = existsSync(settingsPath)
    ? JSON.parse(readFileSync(settingsPath, 'utf8') || '{}')
    : {};
  existing.enabledPlugins = existing.enabledPlugins ?? {};
  existing.enabledPlugins['claudepanion@local'] = true;
  existing.extraKnownMarketplaces = existing.extraKnownMarketplaces ?? {};
  existing.extraKnownMarketplaces['local'] = {
    source: { source: 'directory', path: repoRoot },
  };
  writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\n');
  console.log(`claudepanion plugin installed in ${settingsPath}`);
  console.log(`Start the server: claudepanion serve`);
}

function pluginUninstall() {
  const cwd = process.cwd();
  const settingsPath = join(cwd, '.claude/settings.local.json');
  if (!existsSync(settingsPath)) {
    console.log('no .claude/settings.local.json here; nothing to uninstall.');
    return;
  }
  const existing = JSON.parse(readFileSync(settingsPath, 'utf8') || '{}');
  if (existing.enabledPlugins) delete existing.enabledPlugins['claudepanion@local'];
  if (existing.extraKnownMarketplaces) delete existing.extraKnownMarketplaces['local'];
  writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\n');
  console.log(`claudepanion plugin uninstalled from ${settingsPath}`);
}

function help() {
  console.log(`claudepanion — localhost companion host for Claude Code

usage:
  claudepanion serve                   start the server
  claudepanion dev                     start the server with watch mode
  claudepanion plugin install          register plugin in this repo
  claudepanion plugin uninstall        unregister plugin from this repo
  claudepanion help                    show this message
`);
}

const [cmd, sub] = process.argv.slice(2);
switch (cmd) {
  case 'serve': serve(); break;
  case 'dev': dev(); break;
  case 'plugin':
    if (sub === 'install') pluginInstall();
    else if (sub === 'uninstall') pluginUninstall();
    else { console.error('unknown plugin subcommand'); help(); process.exit(1); }
    break;
  case 'help':
  case undefined:
    help(); break;
  default:
    console.error(`unknown command: ${cmd}`);
    help();
    process.exit(1);
}
```

- [ ] **Step 3: Make it executable**

Run:
```bash
chmod +x bin/claudepanion
```

- [ ] **Step 4: Update `package.json` `bin` field**

In `package.json`:
```json
"bin": {
  "claudepanion": "bin/claudepanion"
}
```

Also update/add scripts:
```json
"scripts": {
  "dev": "tsx watch src/server.ts",
  "serve": "tsx src/server.ts",
  "test": "vitest run",
  "test:watch": "vitest",
  "check": "tsc --noEmit",
  "build": "tsc",
  "install:global": "npm link",
  "uninstall:global": "npm unlink"
}
```

- [ ] **Step 5: Test install + uninstall locally**

From a scratch directory outside the repo:

```bash
mkdir -p /tmp/cp-test && cd /tmp/cp-test
node /home/sean/projects/claude-manager/bin/claudepanion plugin install
cat .claude/settings.local.json
```
Expected: JSON shows `enabledPlugins["claudepanion@local"] = true` and marketplace entry pointing at repo root.

```bash
node /home/sean/projects/claude-manager/bin/claudepanion plugin uninstall
cat .claude/settings.local.json
```
Expected: entries removed.

- [ ] **Step 6: Test serve command**

```bash
node bin/claudepanion serve
```
Expected: server boots. Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git add bin/claudepanion package.json
chmod +x bin/claudepanion  # re-assert in case permissions weren't in the commit
git commit -m "feat(cli): add claudepanion binary with serve, dev, plugin install/uninstall"
```

---

## Task 17: Rename — claude-manager → claudepanion (single commit)

**Files:**
- Modify: `package.json` `name`
- Modify: `.claude-plugin/plugin.json` `name`
- Modify: `.claude-plugin/marketplace.json` (plugin entry)
- Modify: `.mcp.json` (server key)
- Delete: `bin/claude-manager` (superseded by `bin/claudepanion` from Task 16)
- Modify: `README.md` (placeholder rewrite here — full rewrite is Task 19)
- Verify: no remaining references to `claude-manager` anywhere except intentional historical mentions

- [ ] **Step 1: Rename `package.json` name**

Set `"name": "claudepanion"`.

- [ ] **Step 2: Update `.claude-plugin/plugin.json`**

```json
{
  "name": "claudepanion",
  "description": "Localhost companion host for Claude Code — build small web apps whose backend is Claude Code over MCP.",
  "version": "0.3.0",
  "author": { "name": "claudepanion" },
  "license": "MIT",
  "keywords": ["mcp", "claude", "companion", "reference-architecture"]
}
```

- [ ] **Step 3: Update `.claude-plugin/marketplace.json`**

Read the current file, find the plugin entry, and rename it from `claude-manager` to `claudepanion`. Preserve the `source: "./"` path.

- [ ] **Step 4: Update `.mcp.json`**

```json
{
  "mcpServers": {
    "claudepanion": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

- [ ] **Step 5: Delete old CLI binary**

```bash
rm bin/claude-manager
```

- [ ] **Step 6: Search for leftover `claude-manager` references**

Run:
```bash
grep -rn "claude-manager" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git .
```

Review each hit. Legitimate keeper references:
- Commit messages / git history (ignore — history is immutable).
- Design spec (`docs/superpowers/specs/2026-04-20-claudepanion-design.md`) — intentionally references the predecessor; leave.
- Implementation plan (`docs/superpowers/plans/2026-04-20-claudepanion.md`) — references in Task titles; leave.

Anything else (package descriptions, UI strings, code comments, README body) → rename to `claudepanion`.

- [ ] **Step 7: Quick README stub**

If README still references claude-manager in body text, do a minimal search-and-replace rename so the doc isn't self-contradicting. Full rewrite is Task 19.

- [ ] **Step 8: Verify server + tests still green**

Run:
```bash
npm run check && npm test
```
Expected: all pass.

Run: `npx tsx src/server.ts` — expect `claudepanion running at http://localhost:3000`. Ctrl-C.

- [ ] **Step 9: Commit rename as one atomic change**

```bash
git add -A
git commit -m "refactor: rename claude-manager → claudepanion across identifiers"
```

---

## Task 18: Docs — README, architecture, companion-contract, troubleshooting

**Files:**
- Rewrite: `README.md`
- Create: `docs/architecture.md` (moves MCP lifecycle internals out of README)
- Create: `docs/companion-contract.md`
- Create: `docs/troubleshooting.md`

- [ ] **Step 1: Write new `README.md`**

```markdown
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
claudepanion serve            # starts the server on http://localhost:3000
```

Open <http://localhost:3000>. Start a new Claude Code session in the claudepanion repo (or any repo with the plugin installed) and the MCP tools plus skills will load.

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

MIT
```

- [ ] **Step 2: Create `docs/architecture.md`**

Move the "MCP setup in detail" and "How the plugin registration works" sections from the original README into this file. Update references to use `claudepanion` naming. Add a section on the companion discovery mechanism (how `loadCompanions()` scans, registers tools, mounts UI, mounts routes).

Structure:

```markdown
# claudepanion Architecture

## Processes and transports

Express server on port 3000. Three public surfaces:
- `GET /c/<slug>` — server-rendered HTML per companion
- `GET/POST/DELETE /mcp` — MCP Streamable HTTP for Claude Code
- `GET /events` — SSE stream for browser live-updates

## MCP lifecycle

### The endpoint

`.mcp.json` at the repo root declares the MCP server. Claude Code reads this at session start and opens a connection at `/mcp`.

### Session lifecycle (Streamable HTTP, stateful)

Every `initialize` request creates a new session with a UUID returned in `Mcp-Session-Id` header. All subsequent requests echo that header. Disconnect cleans up. Stateless mode was considered but rejected because the SDK requires a fresh transport per request in stateless mode, which is awkward for a long-lived localhost process serving both the UI and MCP.

### Tool registration

At server start, `loadCompanions()` discovers every `companions/<slug>/` directory, loads each one's `tools/*.ts`, prefixes tool names with `<slug>_`, and registers them on the per-session `McpServer`. A fresh `McpServer` is created for each session and wired with the full tool set.

## Companion discovery

On boot, `src/companions.ts#loadCompanions(dir)`:
1. Lists directories under `companions/` alphabetically.
2. Reads each `manifest.json`, validates `slug` against `^[a-z][a-z0-9-]*$`, checks uniqueness.
3. Dynamically imports `tools/*.ts` files, prefixes tool names with `<slug>_`.
4. Imports `ui.ts` and captures `renderPage`.
5. Imports optional `routes.ts` and captures the default-exported Router.
6. Returns `Companion[]` which the server uses to mount UI routes, REST routes, and MCP tools.

New companions require a server restart to be picked up. In dev mode (`claudepanion dev`), `tsx watch` restarts automatically on file changes.

## Request lifecycle (polling pattern)

Most companions follow the polling pattern implemented by `src/helpers/requestStore.ts`:

1. User submits work via `POST /api/c/<slug>/requests` (handled by the helper's router).
2. Request written to `data/<slug>.json` with `status: pending`, `version: 1`.
3. Claude calls `<slug>_list` → `<slug>_claim(id, version)` (optimistic concurrency).
4. Claude calls `<slug>_log(id, msg)` as it works; each call broadcasts SSE to the UI.
5. Claude calls `<slug>_complete(id, { summary, files })` on success or `{ error }` on failure.
6. Helper persists the terminal state; tool handler broadcasts final update.

Version bumps on every mutation enable optimistic-concurrency claim races (two simultaneous claimers; second gets rejected cleanly).

## SSE

`/events` is a single stream. Companions broadcast scoped events via `ctx.broadcast('<slug>.<verb>', data)`. The platform fan-outs to every connected browser. Heartbeat every 25s keeps intermediaries from idle-timeout.

## Plugin registration

`claudepanion plugin install` edits `.claude/settings.local.json` in the current repo to enable the plugin and register a local directory marketplace pointing at the claudepanion clone. See the CLI source at `bin/claudepanion` for exact shape.
```

- [ ] **Step 3: Create `docs/companion-contract.md`**

```markdown
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
```

- [ ] **Step 4: Create `docs/troubleshooting.md`**

```markdown
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
PORT=3001 claudepanion serve
```
Or find and stop the other process: `lsof -i :3000`.

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
```

- [ ] **Step 5: Commit**

```bash
git add README.md docs/architecture.md docs/companion-contract.md docs/troubleshooting.md
git commit -m "docs: rewrite README, add architecture/contract/troubleshooting docs"
```

---

## Task 19: Final verification + push

- [ ] **Step 1: Full typecheck**

Run: `npm run check`
Expected: clean.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all tests pass (target: ~25+ tests across unit and integration).

- [ ] **Step 3: Smoke-test dev mode**

Run: `claudepanion dev` (or `npx tsx watch src/server.ts`).

Expected:
- Server starts, `[claudepanion] loaded 1 companion(s): build`.
- Open http://localhost:3000 — redirects to `/c/build`, form visible, empty request list.
- Submit a sample description in the textbox.
- Request appears with `pending` badge.

Stop server.

- [ ] **Step 4: Smoke-test plugin install**

From another repo:
```bash
cd /tmp && mkdir cp-smoke && cd cp-smoke
claudepanion plugin install
cat .claude/settings.local.json
```
Expected: claudepanion plugin enabled, local marketplace registered with path = the claudepanion repo root.

```bash
claudepanion plugin uninstall
```
Expected: entries removed.

- [ ] **Step 5: Push to origin**

```bash
git push origin main
```

- [ ] **Step 6: Verify on GitHub**

Open https://github.com/sean1588/claudepanion. Verify all commits are present, README renders correctly.

---

## Appendix A: Directory rename (optional)

The repo directory on disk is still `claude-manager`. This is separate from the project rename (which covered identifiers, package name, plugin name). If you want the filesystem name to match:

```bash
cd ..
mv claude-manager claudepanion
cd claudepanion
# update any absolute paths in shell history; re-link if needed:
npm run uninstall:global
npm run install:global
```

This breaks any `.claude/settings.local.json` in other repos that referenced `/path/to/claude-manager` — you'll need to `claudepanion plugin install` again in each. Defer if not causing friction.

---

## Spec coverage map

For self-review:

| Spec section | Tasks |
|--------------|-------|
| §1 Positioning & scope | README (Task 18), plugin.json (Task 17) |
| §2 Architecture & file layout | Tasks 2, 3, 4, 5, 6, 7, 12 |
| §3 Claude-facing surface — MCP + Build + skills | Tasks 7, 8, 9, 11, 15 |
| §4 Human-facing surface — UI/routing/data | Tasks 10, 12, 13 |
| §5 Housekeeping — rename, dev mode, errors, tests | Tasks 1, 14, 16, 17, 19 |
| §6 Open questions / deferred | Task 16 CLI omits auto-port-pick (confirmed) |
| §7 Implementation phases | All tasks ordered accordingly |
