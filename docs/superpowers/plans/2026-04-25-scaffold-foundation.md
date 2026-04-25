# Scaffold Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the foundation primitives (config preflight, error helpers, write-tool safety, BaseArtifact, About page) so chip examples can be built on a clean contract.

**Architecture:** Four phases. Phase 1 adds type contracts only — no behavior change. Phase 2 adds the preflight endpoint and form banner. Phase 3 builds the About page (default landing per `/c/<name>`) plus generic artifact rendering. Phase 4 updates skill templates.

**Tech Stack:** TypeScript, React 18, Vite 6, Express, Zod 4, Vitest, MCP SDK. The host runs on one Express process at port 3001 serving REST API, MCP, and the React SPA.

**Spec reference:** `docs/scaffold-spec.md` is the contract this plan satisfies.

---

## File structure

### Files to create

| Path | Responsibility |
|---|---|
| `src/client/hooks/usePreflight.ts` | Fetches preflight status for a companion; exposes `{ ok, missingRequired, missingOptional, loading }` |
| `src/client/components/PreflightBanner.tsx` | Renders blocking/soft banners based on preflight status |
| `src/client/components/BaseArtifactPanel.tsx` | Generic wrapper rendering `summary` + companion artifact + `errors[]` |
| `src/client/pages/CompanionAbout.tsx` | About page for any companion (manifest + preflight + tools) |
| `src/client/pages/EntityList.tsx` | NOTE: already exists. Will be relocated route-wise to `/c/:companion/runs` |
| `tests/client/PreflightBanner.test.tsx` | Banner rendering tests |
| `tests/client/BaseArtifactPanel.test.tsx` | Panel rendering tests |
| `tests/client/CompanionAbout.test.tsx` | About page tests |
| `tests/client/usePreflight.test.tsx` | Hook tests |

### Files to modify

| Path | Change |
|---|---|
| `src/shared/types.ts` | Add `BaseArtifact`, manifest fields, `sideEffect`, error helpers |
| `src/server/api-routes.ts` | Add `GET /api/companions/:name/preflight`; extend `/api/tools/:companion` with `sideEffect` |
| `src/server/reliability/validator.ts` | Accept `requiredEnv` / `optionalEnv` if present (no enforcement) |
| `companions/build/types.ts` | `BuildArtifact extends BaseArtifact` |
| `src/client/App.tsx` | Add routes: `/c/:companion` → About (was List), `/c/:companion/runs` → List |
| `src/client/pages/CompanionRoute.tsx` | Route to About by default (was List for entity-kind) |
| `src/client/pages/NewEntity.tsx` | Embed `<PreflightBanner>` above the form |
| `src/client/pages/EntityDetail.tsx` | Wrap completed body's artifact in `<BaseArtifactPanel>` |
| `src/client/components/Sidebar.tsx` | Update links to `/c/:name` (was `/c/:name`) — verify link target stays correct |
| `src/client/components/Breadcrumb.tsx` | Verify breadcrumb to companion home points to About |
| `companions/build/templates/skill.md` | Add continuation, preflight, error handling sections |
| `skills/build-companion/SKILL.md` | Add explicit read-only bias when interpreting requests |
| `companions/build/templates/entity/server/tools.ts` | Comment example using new error helpers |
| `docs/scaffold-spec.md` | Update §11 to mention `BaseArtifact`; update implementation status table |
| `tests/server/api-routes.test.ts` | Tests for preflight endpoint and `sideEffect` field |
| `tests/server/companion-registry.test.ts` | Manifest with `requiredEnv` accepted |
| `tests/server/tool-meta.test.ts` | Tests for `configErrorResult`, `inputErrorResult`, `transientErrorResult` |
| `tests/server/reliability/validator.test.ts` | Validator accepts manifest with `requiredEnv` |

---

## Phase 1 — Type Contracts

### Task 1: Add `BaseArtifact`, `sideEffect`, and error helpers to `shared/types.ts`

**Files:**
- Modify: `src/shared/types.ts`
- Test: `tests/server/tool-meta.test.ts`

- [ ] **Step 1: Write failing tests for the three error helpers**

Append to `tests/server/tool-meta.test.ts` after the existing describe blocks:

```ts
import { configErrorResult, inputErrorResult, transientErrorResult } from "../../src/shared/types";

describe("error class helpers", () => {
  it("configErrorResult prefixes [config] and includes envVar", () => {
    const r = configErrorResult("GITHUB_TOKEN");
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe("[config] GITHUB_TOKEN is not set");
  });

  it("configErrorResult includes hint when provided", () => {
    const r = configErrorResult("GITHUB_TOKEN", "create a token with repo scope");
    expect(r.content[0].text).toBe("[config] GITHUB_TOKEN is not set — create a token with repo scope");
  });

  it("inputErrorResult prefixes [input]", () => {
    const r = inputErrorResult("PR not found");
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe("[input] PR not found");
  });

  it("transientErrorResult prefixes [transient]", () => {
    const r = transientErrorResult("rate limited");
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe("[transient] rate limited");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/tool-meta.test.ts`
Expected: 4 new tests fail with "configErrorResult is not a function" or similar import error.

- [ ] **Step 3: Add `BaseArtifact`, `sideEffect`, and helpers to `src/shared/types.ts`**

Append to `src/shared/types.ts` (after `errorResult`):

```ts
export function configErrorResult(envVar: string, hint?: string): McpToolResult {
  return errorResult(`[config] ${envVar} is not set${hint ? ` — ${hint}` : ""}`);
}

export function inputErrorResult(message: string): McpToolResult {
  return errorResult(`[input] ${message}`);
}

export function transientErrorResult(message: string): McpToolResult {
  return errorResult(`[transient] ${message}`);
}
```

Also add the `BaseArtifact` interface near the top (after `Entity`):

```ts
/**
 * Common fields every artifact may carry. Companions should extend this
 * interface for their specific Artifact type.
 */
export interface BaseArtifact {
  /** Short one-liner describing the run's outcome. Shown in the List row and Detail header. */
  summary?: string;
  /** Recoverable issues encountered during the run. Rendered as a "Notes during this run" section by the host. */
  errors?: string[];
}
```

Modify `CompanionToolDefinition` to add `sideEffect`:

```ts
export interface CompanionToolDefinition<
  TParams extends Record<string, unknown> = Record<string, unknown>,
> {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  /** Defaults to "read". Set to "write" for tools that change state in external systems —
   *  triggers permission-prompt flow in the skill and a warning badge on the About page. */
  sideEffect?: "read" | "write";
  handler: (params: TParams) => Promise<McpToolResult>;
}
```

Modify `Manifest` to add config fields:

```ts
export interface Manifest {
  name: string;
  kind: CompanionKind;
  displayName: string;
  icon: string;
  description: string;
  contractVersion: string;
  version: string;
  /** Env vars the companion requires. Preflight surfaces missing values; form blocks submission. */
  requiredEnv?: string[];
  /** Env vars that enable extra features but aren't required. Preflight surfaces as soft warning. */
  optionalEnv?: string[];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/tool-meta.test.ts`
Expected: all tests pass (existing + 4 new).

- [ ] **Step 5: Run typecheck to verify no breakage**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts tests/server/tool-meta.test.ts
git commit -m "$(cat <<'EOF'
feat(types): add BaseArtifact, sideEffect, manifest config fields, error helpers

- BaseArtifact interface: summary?, errors? — companions extend it
- CompanionToolDefinition.sideEffect: "read" | "write"
- Manifest.requiredEnv / optionalEnv for declared config dependencies
- configErrorResult / inputErrorResult / transientErrorResult helpers
EOF
)"
```

### Task 2: Update `BuildArtifact` to extend `BaseArtifact`

**Files:**
- Modify: `companions/build/types.ts`

- [ ] **Step 1: Update the interface**

Replace the file contents:

```ts
import type { BaseArtifact } from "../../src/shared/types.js";

export type BuildInput =
  | {
      mode: "new-companion";
      name: string;
      kind: "entity" | "tool";
      description: string;
      /** Slug of the BuildExample that prefilled this submission, if any. Drives skillTemplate lookup during scaffolding. */
      example?: string;
    }
  | {
      mode: "iterate-companion";
      target: string;
      description: string;
    };

export interface BuildArtifact extends BaseArtifact {
  filesCreated: string[];
  filesModified: string[];
  /** Required for Build runs (overrides BaseArtifact's optional summary). */
  summary: string;
  validatorPassed: boolean;
  smokeTestPassed: boolean;
}
```

- [ ] **Step 2: Verify typecheck still passes**

Run: `npm run check`
Expected: no errors. The `summary: string` (required) overrides `summary?: string` (optional) — TypeScript allows this narrowing.

- [ ] **Step 3: Run all tests**

Run: `npm test -- --run`
Expected: all 102+ tests pass (4 new from Task 1).

- [ ] **Step 4: Commit**

```bash
git add companions/build/types.ts
git commit -m "feat(build): BuildArtifact extends BaseArtifact"
```

### Task 3: Update validator to accept new manifest fields

**Files:**
- Modify: `src/server/reliability/validator.ts` (no functional change — fields are accepted as `any` extras since validator doesn't reject unknown fields, but add explicit type signal)
- Test: `tests/server/reliability/validator.test.ts`

- [ ] **Step 1: Write failing test**

Append to `tests/server/reliability/validator.test.ts`:

```ts
it("accepts manifest with requiredEnv and optionalEnv", () => {
  const r = validateCompanion({
    manifest: { ...baseManifest, requiredEnv: ["GITHUB_TOKEN"], optionalEnv: ["SLACK_TOKEN"] },
    module: null,
    companionDir: null,
  });
  expect(r.ok).toBe(true);
  expect(r.issues.filter((i) => i.fatal)).toEqual([]);
});

it("accepts manifest with requiredEnv that is empty array", () => {
  const r = validateCompanion({
    manifest: { ...baseManifest, requiredEnv: [] },
    module: null,
    companionDir: null,
  });
  expect(r.ok).toBe(true);
});

it("flags non-array requiredEnv as non-fatal", () => {
  const r = validateCompanion({
    manifest: { ...baseManifest, requiredEnv: "GITHUB_TOKEN" as any },
    module: null,
    companionDir: null,
  });
  expect(r.issues.some((i) => i.code === "manifest.requiredEnv.invalid")).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/reliability/validator.test.ts`
Expected: third test fails — no `manifest.requiredEnv.invalid` issue produced.

- [ ] **Step 3: Add validation in validator.ts**

Add this block in `validateCompanion` after the existing `displayName/icon/description` loop, before the tool name check:

```ts
for (const field of ["requiredEnv", "optionalEnv"] as const) {
  const v = (m as any)[field];
  if (v !== undefined && (!Array.isArray(v) || v.some((x) => typeof x !== "string"))) {
    issues.push({
      code: `manifest.${field}.invalid`,
      message: `${field} must be a string[] when present`,
      fatal: false,
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/reliability/validator.test.ts`
Expected: all pass (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/server/reliability/validator.ts tests/server/reliability/validator.test.ts
git commit -m "feat(validator): accept and shape-check requiredEnv/optionalEnv"
```

---

## Phase 2 — Preflight System

### Task 4: Add `GET /api/companions/:name/preflight` endpoint

**Files:**
- Modify: `src/server/api-routes.ts`
- Test: `tests/server/api-routes.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/server/api-routes.test.ts` inside the existing `describe("api routes", ...)` block:

```ts
it("GET /api/companions/:name/preflight returns ok:true for companion with no env declared", async () => {
  const res = await request(app).get("/api/companions/x/preflight");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true, missingRequired: [], missingOptional: [] });
});

it("GET /api/companions/:name/preflight 404s for unknown companion", async () => {
  const res = await request(app).get("/api/companions/nope/preflight");
  expect(res.status).toBe(404);
});
```

For requiredEnv testing, we need a companion declared with env vars. Add a new test block at the end of the file:

```ts
describe("preflight with required env", () => {
  let envBackup: string | undefined;

  beforeEach(() => {
    envBackup = process.env.X_TOKEN;
    delete process.env.X_TOKEN;
  });

  afterEach(() => {
    if (envBackup !== undefined) process.env.X_TOKEN = envBackup;
    else delete process.env.X_TOKEN;
  });

  function setupAppWithEnv(reqEnv: string[], optEnv: string[] = []) {
    const tmp2 = mkdtempSync(join(tmpdir(), "claudepanion-pf-"));
    const store = createEntityStore(tmp2);
    const m: Manifest = { ...manifest("env-test"), requiredEnv: reqEnv, optionalEnv: optEnv };
    const registry = createRegistry([{ manifest: m, tools: [] }]);
    const app2 = express();
    app2.use(express.json());
    mountApiRoutes(app2, { store, registry });
    return app2;
  }

  it("preflight reports missingRequired when env not set", async () => {
    const a = setupAppWithEnv(["X_TOKEN"]);
    const res = await request(a).get("/api/companions/env-test/preflight");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.missingRequired).toEqual(["X_TOKEN"]);
  });

  it("preflight returns ok:true when required env is set", async () => {
    process.env.X_TOKEN = "value";
    const a = setupAppWithEnv(["X_TOKEN"]);
    const res = await request(a).get("/api/companions/env-test/preflight");
    expect(res.body.ok).toBe(true);
    expect(res.body.missingRequired).toEqual([]);
  });

  it("preflight reports missingOptional but ok:true when only optional is missing", async () => {
    const a = setupAppWithEnv([], ["OPT_TOKEN"]);
    const res = await request(a).get("/api/companions/env-test/preflight");
    expect(res.body.ok).toBe(true);
    expect(res.body.missingOptional).toEqual(["OPT_TOKEN"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/api-routes.test.ts`
Expected: 5 new tests fail with 404 (route doesn't exist).

- [ ] **Step 3: Implement the endpoint**

In `src/server/api-routes.ts`, add this route inside `mountApiRoutes` near the other `app.get("/api/companions...")` handlers:

```ts
app.get("/api/companions/:name/preflight", (req: Request, res: Response) => {
  const name = String(req.params.name);
  const c = registry.get(name);
  if (!c) return res.status(404).json({ error: `unknown companion: ${name}` });
  const requiredEnv = c.manifest.requiredEnv ?? [];
  const optionalEnv = c.manifest.optionalEnv ?? [];
  const missingRequired = requiredEnv.filter((v) => !process.env[v]);
  const missingOptional = optionalEnv.filter((v) => !process.env[v]);
  res.json({ ok: missingRequired.length === 0, missingRequired, missingOptional });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/api-routes.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/api-routes.ts tests/server/api-routes.test.ts
git commit -m "feat(api): preflight endpoint reports config readiness from requiredEnv/optionalEnv"
```

### Task 5: Build the `usePreflight` hook

**Files:**
- Create: `src/client/hooks/usePreflight.ts`
- Create: `tests/client/usePreflight.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/client/usePreflight.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePreflight } from "../../src/client/hooks/usePreflight";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/companions/x/preflight") {
      return new Response(JSON.stringify({ ok: false, missingRequired: ["TOKEN"], missingOptional: [] }), { status: 200 });
    }
    if (url === "/api/companions/y/preflight") {
      return new Response(JSON.stringify({ ok: true, missingRequired: [], missingOptional: [] }), { status: 200 });
    }
    if (url === "/api/companions/missing/preflight") {
      return new Response(JSON.stringify({ error: "unknown" }), { status: 404 });
    }
    throw new Error(`unexpected url: ${url}`);
  }));
});
afterEach(() => vi.restoreAllMocks());

describe("usePreflight", () => {
  it("returns missingRequired when env is not set", async () => {
    const { result } = renderHook(() => usePreflight("x"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ok).toBe(false);
    expect(result.current.missingRequired).toEqual(["TOKEN"]);
  });

  it("returns ok:true when no missing env", async () => {
    const { result } = renderHook(() => usePreflight("y"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ok).toBe(true);
  });

  it("treats 404 as ok:true (companion has no preflight requirement)", async () => {
    const { result } = renderHook(() => usePreflight("missing"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/client/usePreflight.test.tsx`
Expected: import error — file doesn't exist.

- [ ] **Step 3: Implement the hook**

Create `src/client/hooks/usePreflight.ts`:

```ts
import { useEffect, useState } from "react";

export interface PreflightStatus {
  ok: boolean;
  missingRequired: string[];
  missingOptional: string[];
  loading: boolean;
}

const INITIAL: PreflightStatus = { ok: true, missingRequired: [], missingOptional: [], loading: true };

export function usePreflight(companion: string | undefined): PreflightStatus {
  const [status, setStatus] = useState<PreflightStatus>(INITIAL);

  useEffect(() => {
    if (!companion) return;
    let cancelled = false;
    setStatus(INITIAL);
    void (async () => {
      try {
        const r = await fetch(`/api/companions/${encodeURIComponent(companion)}/preflight`);
        if (cancelled) return;
        if (r.status === 404) {
          // Treat as no preflight requirement — backwards-compatible.
          setStatus({ ok: true, missingRequired: [], missingOptional: [], loading: false });
          return;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setStatus({ ...data, loading: false });
      } catch {
        if (!cancelled) setStatus({ ok: true, missingRequired: [], missingOptional: [], loading: false });
      }
    })();
    return () => { cancelled = true; };
  }, [companion]);

  return status;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run tests/client/usePreflight.test.tsx`
Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/client/hooks/usePreflight.ts tests/client/usePreflight.test.tsx
git commit -m "feat(client): usePreflight hook fetches companion preflight status"
```

### Task 6: Build `PreflightBanner` component

**Files:**
- Create: `src/client/components/PreflightBanner.tsx`
- Create: `tests/client/PreflightBanner.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/client/PreflightBanner.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PreflightBanner from "../../src/client/components/PreflightBanner";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/companions/blocked/preflight") {
      return new Response(JSON.stringify({ ok: false, missingRequired: ["GITHUB_TOKEN"], missingOptional: [] }), { status: 200 });
    }
    if (url === "/api/companions/warn/preflight") {
      return new Response(JSON.stringify({ ok: true, missingRequired: [], missingOptional: ["SLACK_TOKEN"] }), { status: 200 });
    }
    if (url === "/api/companions/ok/preflight") {
      return new Response(JSON.stringify({ ok: true, missingRequired: [], missingOptional: [] }), { status: 200 });
    }
    throw new Error(`unexpected url: ${url}`);
  }));
});
afterEach(() => vi.restoreAllMocks());

describe("PreflightBanner", () => {
  it("renders blocking banner when missingRequired non-empty", async () => {
    render(<PreflightBanner companion="blocked" />);
    await waitFor(() => expect(screen.getByText(/GITHUB_TOKEN/)).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/required/i);
  });

  it("renders soft banner when only missingOptional", async () => {
    render(<PreflightBanner companion="warn" />);
    await waitFor(() => expect(screen.getByText(/SLACK_TOKEN/)).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent(/optional/i);
  });

  it("renders nothing when all env is set", async () => {
    const { container } = render(<PreflightBanner companion="ok" />);
    await waitFor(() => expect(container.textContent).not.toContain("loading"));
    expect(container.firstChild).toBeNull();
  });

  it("calls onStatus with blocked=true when required env missing", async () => {
    const onStatus = vi.fn();
    render(<PreflightBanner companion="blocked" onStatus={onStatus} />);
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ blocked: true })));
  });

  it("calls onStatus with blocked=false when ok", async () => {
    const onStatus = vi.fn();
    render(<PreflightBanner companion="ok" onStatus={onStatus} />);
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ blocked: false })));
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/client/PreflightBanner.test.tsx`
Expected: import error.

- [ ] **Step 3: Implement the component**

Create `src/client/components/PreflightBanner.tsx`:

```tsx
import { useEffect } from "react";
import { usePreflight } from "../hooks/usePreflight";

export interface PreflightBannerProps {
  companion: string;
  /** Called whenever the preflight status changes. Useful for the parent form to disable submit. */
  onStatus?: (s: { blocked: boolean; missingRequired: string[]; missingOptional: string[] }) => void;
}

export default function PreflightBanner({ companion, onStatus }: PreflightBannerProps) {
  const status = usePreflight(companion);

  useEffect(() => {
    if (status.loading) return;
    onStatus?.({
      blocked: !status.ok,
      missingRequired: status.missingRequired,
      missingOptional: status.missingOptional,
    });
  }, [status.loading, status.ok, status.missingRequired, status.missingOptional, onStatus]);

  if (status.loading) return null;
  if (status.ok && status.missingOptional.length === 0) return null;

  if (!status.ok) {
    return (
      <div role="alert" className="preflight-banner preflight-banner-blocking">
        <strong>⚠️ Configuration required.</strong>{" "}
        This companion needs the following environment {status.missingRequired.length === 1 ? "variable" : "variables"} to run:
        <ul style={{ margin: "8px 0 0 20px" }}>
          {status.missingRequired.map((v) => (<li key={v}><code>{v}</code></li>))}
        </ul>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
          Set them in your environment, then reload this page.
        </div>
      </div>
    );
  }

  return (
    <div role="status" className="preflight-banner preflight-banner-soft">
      <strong>Optional config not set.</strong>{" "}
      Some features may be limited:
      <ul style={{ margin: "8px 0 0 20px" }}>
        {status.missingOptional.map((v) => (<li key={v}><code>{v}</code></li>))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Add CSS**

Append to `src/client/styles.css` (or wherever the global styles live — check `src/client/main.tsx` import to confirm path):

```css
.preflight-banner {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}
.preflight-banner-blocking {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}
.preflight-banner-soft {
  background: #fefce8;
  border: 1px solid #fde68a;
  color: #854d0e;
}
.preflight-banner code {
  background: rgba(0, 0, 0, 0.05);
  padding: 1px 6px;
  border-radius: 4px;
}
```

If `src/client/styles.css` doesn't exist, add the styles inline via the component's existing `style` props.

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run tests/client/PreflightBanner.test.tsx`
Expected: all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/client/components/PreflightBanner.tsx tests/client/PreflightBanner.test.tsx src/client/styles.css
git commit -m "feat(client): PreflightBanner renders blocking and soft banners from preflight status"
```

### Task 7: Wire `PreflightBanner` into `NewEntity`

**Files:**
- Modify: `src/client/pages/NewEntity.tsx`
- Modify: `tests/client/NewEntity.test.tsx`

- [ ] **Step 1: Update the failing test**

Add a new test block to `tests/client/NewEntity.test.tsx` after the existing test:

```tsx
it("disables submit when preflight reports blocked status", async () => {
  // Override fetch to return a blocked preflight for build
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/companions") {
      return new Response(JSON.stringify([
        { name: "build", kind: "entity", displayName: "Build", icon: "🔨", description: "", contractVersion: "1", version: "0.1.0", requiredEnv: ["BLOCKED_TOKEN"] },
      ]), { status: 200 });
    }
    if (url === "/api/companions/build/preflight") {
      return new Response(JSON.stringify({ ok: false, missingRequired: ["BLOCKED_TOKEN"], missingOptional: [] }), { status: 200 });
    }
    if (url === "/api/entities" && init?.method === "POST") {
      return new Response(JSON.stringify({ id: "build-zzz999", companion: "build", status: "pending", input: {}, logs: [], createdAt: "", updatedAt: "", statusMessage: null, artifact: null, errorMessage: null, errorStack: null }), { status: 201 });
    }
    throw new Error(`unexpected ${url}`);
  }));

  render(
    <MemoryRouter initialEntries={["/c/build/new"]}>
      <Routes>
        <Route path="/c/:companion/new" element={<NewEntity />} />
      </Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText(/BLOCKED_TOKEN/)).toBeInTheDocument());
  // Submit button should be disabled
  const button = screen.getByRole("button", { name: /scaffold companion/i });
  expect(button).toBeDisabled();
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/client/NewEntity.test.tsx`
Expected: new test fails — banner not present, button not disabled.

- [ ] **Step 3: Update NewEntity to render the banner and respect blocked state**

Replace `src/client/pages/NewEntity.tsx`:

```tsx
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Manifest } from "@shared/types";
import { createEntity, fetchCompanions } from "../api";
import { getForm } from "../../../companions/client";
import Breadcrumb from "../components/Breadcrumb";
import PreflightBanner from "../components/PreflightBanner";

export default function NewEntity() {
  const { companion = "" } = useParams();
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    void fetchCompanions().then((all) => setManifest(all.find((m) => m.name === companion) ?? null));
  }, [companion]);

  if (!manifest) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  const Form = getForm(companion);
  if (!Form) return <div>No form registered for {companion}.</div>;

  return (
    <>
      <Breadcrumb manifest={manifest} trailing="New" />
      <div className="page-title"><h1>{companion === "build" ? "New companion" : "New entry"}</h1></div>
      <PreflightBanner companion={companion} onStatus={(s) => setBlocked(s.blocked)} />
      <fieldset disabled={blocked} style={{ border: "none", padding: 0, margin: 0 }}>
        <Form onSubmit={async (input) => {
          if (blocked) return;
          const e = await createEntity(companion, input);
          navigate(`/c/${companion}/${e.id}`);
        }} />
      </fieldset>
    </>
  );
}
```

The `<fieldset disabled>` pattern disables all form controls inside, including the submit button.

- [ ] **Step 4: Run all tests**

Run: `npm test -- --run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/client/pages/NewEntity.tsx tests/client/NewEntity.test.tsx
git commit -m "feat(client): NewEntity wraps form in PreflightBanner; blocks submission when config missing"
```

---

## Phase 3 — About Page, Routing, Base Artifact

### Task 8: Add `sideEffect` to `/api/tools/:companion` response

**Files:**
- Modify: `src/server/api-routes.ts`
- Modify: `tests/server/api-routes.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/server/api-routes.test.ts` after the existing tests, in a new describe block:

```ts
import { z } from "zod";
import { successResult } from "../../src/shared/types";
import type { CompanionToolDefinition } from "../../src/shared/types";

describe("tools endpoint sideEffect", () => {
  it("returns sideEffect on each tool descriptor", async () => {
    const tmp2 = mkdtempSync(join(tmpdir(), "claudepanion-tools-"));
    const store = createEntityStore(tmp2);
    const toolReadOnly: CompanionToolDefinition = {
      name: "tk_read",
      description: "read",
      schema: {},
      sideEffect: "read",
      async handler() { return successResult({}); },
    };
    const toolWrite: CompanionToolDefinition = {
      name: "tk_write",
      description: "write",
      schema: {},
      sideEffect: "write",
      async handler() { return successResult({}); },
    };
    const m: Manifest = { ...manifest("tk"), kind: "tool" };
    const registry = createRegistry([{ manifest: m, tools: [toolReadOnly, toolWrite] }]);
    const app2 = express();
    app2.use(express.json());
    mountApiRoutes(app2, { store, registry });

    const res = await request(app2).get("/api/tools/tk");
    expect(res.status).toBe(200);
    const tools = res.body.tools as Array<{ name: string; sideEffect?: string }>;
    expect(tools.find((t) => t.name === "tk_read")?.sideEffect).toBe("read");
    expect(tools.find((t) => t.name === "tk_write")?.sideEffect).toBe("write");
  });

  it("defaults sideEffect to 'read' when not specified", async () => {
    const tmp2 = mkdtempSync(join(tmpdir(), "claudepanion-tools-"));
    const store = createEntityStore(tmp2);
    const toolNoFlag: CompanionToolDefinition = {
      name: "tk_default",
      description: "no flag",
      schema: {},
      async handler() { return successResult({}); },
    };
    const m: Manifest = { ...manifest("tk"), kind: "tool" };
    const registry = createRegistry([{ manifest: m, tools: [toolNoFlag] }]);
    const app2 = express();
    app2.use(express.json());
    mountApiRoutes(app2, { store, registry });
    const res = await request(app2).get("/api/tools/tk");
    expect(res.body.tools[0].sideEffect).toBe("read");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/server/api-routes.test.ts`
Expected: 2 new tests fail — `sideEffect` undefined.

- [ ] **Step 3: Update the descriptor in api-routes.ts**

In `src/server/api-routes.ts`, update the descriptors mapping inside the `/api/tools/:companion` handler:

```ts
const descriptors = c.tools.map((def) => ({
  name: def.name,
  description: def.description,
  params: Object.entries(def.schema).map(([key, schema]) => ({
    name: key,
    required: !(schema as any).isOptional?.(),
    description: (schema as any)._def?.description ?? "",
  })),
  signature: signatureFromDef(def),
  sideEffect: def.sideEffect ?? "read",
}));
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/server/api-routes.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/api-routes.ts tests/server/api-routes.test.ts
git commit -m "feat(api): /api/tools response carries sideEffect (default 'read')"
```

### Task 9: Build `BaseArtifactPanel` component

**Files:**
- Create: `src/client/components/BaseArtifactPanel.tsx`
- Create: `tests/client/BaseArtifactPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/client/BaseArtifactPanel.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BaseArtifactPanel from "../../src/client/components/BaseArtifactPanel";

const baseEntity = {
  id: "x-123",
  companion: "x",
  status: "completed" as const,
  statusMessage: null,
  createdAt: "2026-04-25T00:00:00Z",
  updatedAt: "2026-04-25T00:00:01Z",
  input: {},
  errorMessage: null,
  errorStack: null,
  logs: [],
};

describe("BaseArtifactPanel", () => {
  it("renders summary banner when artifact has summary", () => {
    render(
      <BaseArtifactPanel entity={{ ...baseEntity, artifact: { summary: "All good" } }}>
        <div>custom-content</div>
      </BaseArtifactPanel>
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
    expect(screen.getByText("custom-content")).toBeInTheDocument();
  });

  it("renders errors section when artifact has errors", () => {
    render(
      <BaseArtifactPanel entity={{ ...baseEntity, artifact: { errors: ["one failed", "two failed"] } }}>
        <div>custom-content</div>
      </BaseArtifactPanel>
    );
    expect(screen.getByText("Notes during this run")).toBeInTheDocument();
    expect(screen.getByText("one failed")).toBeInTheDocument();
    expect(screen.getByText("two failed")).toBeInTheDocument();
  });

  it("renders only children when artifact has no summary or errors", () => {
    render(
      <BaseArtifactPanel entity={{ ...baseEntity, artifact: { somethingElse: 1 } }}>
        <div>custom-content</div>
      </BaseArtifactPanel>
    );
    expect(screen.queryByText("Notes during this run")).not.toBeInTheDocument();
    expect(screen.getByText("custom-content")).toBeInTheDocument();
  });

  it("renders only children when artifact is null", () => {
    render(
      <BaseArtifactPanel entity={{ ...baseEntity, artifact: null }}>
        <div>custom-content</div>
      </BaseArtifactPanel>
    );
    expect(screen.getByText("custom-content")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/client/BaseArtifactPanel.test.tsx`
Expected: import error.

- [ ] **Step 3: Implement the component**

Create `src/client/components/BaseArtifactPanel.tsx`:

```tsx
import type { ReactNode } from "react";
import type { Entity } from "@shared/types";

export interface BaseArtifactPanelProps {
  entity: Entity;
  children: ReactNode;
}

interface PartialBase {
  summary?: unknown;
  errors?: unknown;
}

export default function BaseArtifactPanel({ entity, children }: BaseArtifactPanelProps) {
  const a = (entity.artifact ?? {}) as PartialBase;
  const summary = typeof a.summary === "string" && a.summary.trim() ? a.summary : null;
  const errors = Array.isArray(a.errors) ? a.errors.filter((e): e is string => typeof e === "string") : [];

  return (
    <>
      {summary && (
        <div className="artifact-summary-banner">
          {summary}
        </div>
      )}
      {children}
      {errors.length > 0 && (
        <div className="artifact-errors">
          <div className="artifact-errors-header">Notes during this run</div>
          <ul className="artifact-errors-list">
            {errors.map((e, i) => (<li key={i}>{e}</li>))}
          </ul>
        </div>
      )}
    </>
  );
}
```

Append CSS to `src/client/styles.css`:

```css
.artifact-summary-banner {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #14532d;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 14px;
}
.artifact-errors {
  background: #fefce8;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 10px 14px;
  margin-top: 12px;
}
.artifact-errors-header {
  font-weight: 600;
  font-size: 13px;
  color: #854d0e;
  margin-bottom: 6px;
}
.artifact-errors-list {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #713f12;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/client/BaseArtifactPanel.test.tsx`
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/client/components/BaseArtifactPanel.tsx tests/client/BaseArtifactPanel.test.tsx src/client/styles.css
git commit -m "feat(client): BaseArtifactPanel renders summary banner and errors[] section"
```

### Task 10: Wire `BaseArtifactPanel` into `EntityDetail`

**Files:**
- Modify: `src/client/pages/EntityDetail.tsx`
- Modify: `tests/client/EntityDetail.test.tsx`

- [ ] **Step 1: Add a test for the panel rendering**

Add to `tests/client/EntityDetail.test.tsx` (alongside existing tests):

```tsx
it("renders summary banner from artifact", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/companions") return new Response(JSON.stringify([
      { name: "build", kind: "entity", displayName: "Build", icon: "🔨", description: "", contractVersion: "1", version: "0.1.0" },
    ]), { status: 200 });
    if (url.startsWith("/api/entities/build-abc")) return new Response(JSON.stringify({
      id: "build-abc", companion: "build", status: "completed",
      statusMessage: null, createdAt: "2026-04-25T00:00:00Z", updatedAt: "2026-04-25T00:00:01Z",
      input: { mode: "new-companion", name: "x", kind: "entity", description: "" },
      artifact: { summary: "Scaffolded x.", errors: ["minor warning"], filesCreated: [], filesModified: [], validatorPassed: true, smokeTestPassed: true },
      errorMessage: null, errorStack: null, logs: [],
    }), { status: 200 });
    throw new Error("unexpected");
  }));

  render(
    <MemoryRouter initialEntries={["/c/build/build-abc"]}>
      <Routes>
        <Route path="/c/:companion/:id" element={<EntityDetail />} />
      </Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText("Scaffolded x.")).toBeInTheDocument());
  expect(screen.getByText("Notes during this run")).toBeInTheDocument();
  expect(screen.getByText("minor warning")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/client/EntityDetail.test.tsx`
Expected: new test fails (no summary rendered yet).

- [ ] **Step 3: Wrap completed body's renderer in BaseArtifactPanel**

In `src/client/pages/EntityDetail.tsx`, modify the `CompletedBody` function:

```tsx
import BaseArtifactPanel from "../components/BaseArtifactPanel";

// ... inside CompletedBody, change the artifact-hero-body section:
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
          <BaseArtifactPanel entity={entity}>
            {Renderer ? <Renderer entity={entity} /> : <pre>{JSON.stringify(entity.artifact, null, 2)}</pre>}
          </BaseArtifactPanel>
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
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/client/EntityDetail.test.tsx`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/client/pages/EntityDetail.tsx tests/client/EntityDetail.test.tsx
git commit -m "feat(client): EntityDetail wraps completed artifact in BaseArtifactPanel"
```

### Task 11: Build `CompanionAbout` page

**Files:**
- Create: `src/client/pages/CompanionAbout.tsx`
- Create: `tests/client/CompanionAbout.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/client/CompanionAbout.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import CompanionAbout from "../../src/client/pages/CompanionAbout";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/companions") return new Response(JSON.stringify([
      { name: "demo", kind: "entity", displayName: "Demo", icon: "✨", description: "Demo companion.", contractVersion: "1", version: "0.1.0", requiredEnv: ["DEMO_TOKEN"] },
    ]), { status: 200 });
    if (url === "/api/companions/demo/preflight") return new Response(JSON.stringify({
      ok: false, missingRequired: ["DEMO_TOKEN"], missingOptional: [],
    }), { status: 200 });
    if (url === "/api/tools/demo") return new Response(JSON.stringify({
      manifest: { name: "demo", kind: "entity", displayName: "Demo", icon: "✨", description: "Demo companion.", contractVersion: "1", version: "0.1.0" },
      tools: [
        { name: "demo_get_thing", description: "Read a thing.", params: [], signature: "demo_get_thing()", sideEffect: "read" },
        { name: "demo_post_thing", description: "Post a thing.", params: [], signature: "demo_post_thing()", sideEffect: "write" },
      ],
    }), { status: 200 });
    throw new Error(`unexpected: ${url}`);
  }));
});
afterEach(() => vi.restoreAllMocks());

describe("CompanionAbout", () => {
  it("renders manifest header", async () => {
    render(
      <MemoryRouter initialEntries={["/c/demo"]}>
        <Routes>
          <Route path="/c/:companion" element={<CompanionAbout />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Demo" })).toBeInTheDocument());
    expect(screen.getByText(/Demo companion/)).toBeInTheDocument();
  });

  it("renders preflight banner when config missing", async () => {
    render(
      <MemoryRouter initialEntries={["/c/demo"]}>
        <Routes>
          <Route path="/c/:companion" element={<CompanionAbout />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("DEMO_TOKEN")).toBeInTheDocument());
  });

  it("groups tools by sideEffect with write tools flagged", async () => {
    render(
      <MemoryRouter initialEntries={["/c/demo"]}>
        <Routes>
          <Route path="/c/:companion" element={<CompanionAbout />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("demo_get_thing")).toBeInTheDocument());
    expect(screen.getByText("demo_post_thing")).toBeInTheDocument();
    // write warning visible
    expect(screen.getByText(/writes to external systems/i)).toBeInTheDocument();
  });

  it("does NOT show write warning when no write tools", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/companions") return new Response(JSON.stringify([
        { name: "ro", kind: "entity", displayName: "RO", icon: "🔍", description: "", contractVersion: "1", version: "0.1.0" },
      ]), { status: 200 });
      if (url === "/api/companions/ro/preflight") return new Response(JSON.stringify({ ok: true, missingRequired: [], missingOptional: [] }), { status: 200 });
      if (url === "/api/tools/ro") return new Response(JSON.stringify({
        manifest: { name: "ro", kind: "entity", displayName: "RO", icon: "🔍", description: "", contractVersion: "1", version: "0.1.0" },
        tools: [{ name: "ro_get", description: "read", params: [], signature: "ro_get()", sideEffect: "read" }],
      }), { status: 200 });
      throw new Error(`unexpected: ${url}`);
    }));
    render(
      <MemoryRouter initialEntries={["/c/ro"]}>
        <Routes>
          <Route path="/c/:companion" element={<CompanionAbout />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("ro_get")).toBeInTheDocument());
    expect(screen.queryByText(/writes to external systems/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/client/CompanionAbout.test.tsx`
Expected: import error.

- [ ] **Step 3: Implement the page**

Create `src/client/pages/CompanionAbout.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Manifest } from "@shared/types";
import Breadcrumb from "../components/Breadcrumb";
import PreflightBanner from "../components/PreflightBanner";
import { fetchCompanions } from "../api";

interface ToolDescriptor {
  name: string;
  description: string;
  params: Array<{ name: string; required?: boolean; description?: string }>;
  signature: string;
  sideEffect: "read" | "write";
}

interface AboutPayload {
  manifest: Manifest;
  tools: ToolDescriptor[];
}

export default function CompanionAbout() {
  const { companion = "" } = useParams();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [payload, setPayload] = useState<AboutPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const all = await fetchCompanions();
        if (!cancelled) setManifest(all.find((m) => m.name === companion) ?? null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [companion]);

  useEffect(() => {
    if (!manifest) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/tools/${encodeURIComponent(companion)}`);
        if (r.status === 400 || r.status === 404) {
          // Entity-kind doesn't have /api/tools; build payload from manifest only.
          if (!cancelled) setPayload({ manifest, tools: [] });
          return;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        if (!cancelled) setPayload(await r.json());
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [companion, manifest]);

  if (error) return <div style={{ color: "#dc2626" }}>Failed to load: {error}</div>;
  if (!manifest || !payload) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  const writeTools = payload.tools.filter((t) => t.sideEffect === "write");
  const readTools = payload.tools.filter((t) => t.sideEffect === "read");
  const hasWrites = writeTools.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Breadcrumb manifest={manifest} />
      <header style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <span style={{ fontSize: 40 }} aria-hidden="true">{manifest.icon}</span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0 }}>{manifest.displayName}</h1>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            claudepanion-{manifest.name} · v{manifest.version}
            {hasWrites
              ? <span className="badge badge-write" style={{ marginLeft: 8 }}>writes to external systems</span>
              : payload.tools.length > 0 && <span className="badge badge-read" style={{ marginLeft: 8 }}>read-only</span>}
          </div>
          <p style={{ marginTop: 8, marginBottom: 0 }}>{manifest.description}</p>
        </div>
        {manifest.kind === "entity" && (
          <Link to={`/c/${manifest.name}/new`} className="btn" style={{ whiteSpace: "nowrap" }}>
            Start a new run
          </Link>
        )}
        <Link to={`/c/${manifest.name}/runs`} className="btn-outline" style={{ whiteSpace: "nowrap" }}>
          View runs
        </Link>
      </header>

      <PreflightBanner companion={companion} />

      {hasWrites && (
        <div role="alert" className="write-tools-warning">
          <strong>⚠️ This companion writes to external systems.</strong>
          <ul style={{ margin: "8px 0 0 20px", fontSize: 13 }}>
            {writeTools.map((t) => (
              <li key={t.name}>
                <code>{t.name}</code> — {t.description}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            The skill will ask for your permission before each write action.
          </div>
        </div>
      )}

      {payload.tools.length > 0 && (
        <section>
          <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 18 }}>MCP tools</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...readTools, ...writeTools].map((t) => (
              <div key={t.name} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}>
                <code style={{ fontSize: 13, fontWeight: 600 }}>
                  {t.name}
                  {t.sideEffect === "write" && <span className="badge badge-write" style={{ marginLeft: 8 }}>write</span>}
                </code>
                {t.description && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{t.description}</div>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

Append CSS to `src/client/styles.css`:

```css
.badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.badge-read {
  background: #f1f5f9;
  color: #475569;
}
.badge-write {
  background: #fee2e2;
  color: #991b1b;
}
.write-tools-warning {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/client/CompanionAbout.test.tsx`
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/client/pages/CompanionAbout.tsx tests/client/CompanionAbout.test.tsx src/client/styles.css
git commit -m "feat(client): CompanionAbout page renders manifest, preflight, and tool list with sideEffect badges"
```

### Task 12: Update routing — About at `/c/:name`, List at `/c/:name/runs`

**Files:**
- Modify: `src/client/App.tsx`
- Modify: `src/client/pages/CompanionRoute.tsx`

- [ ] **Step 1: Add explicit route for runs**

Replace `src/client/App.tsx`:

```tsx
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import CompanionRoute from "./pages/CompanionRoute";
import NewEntity from "./pages/NewEntity";
import EntityDetail from "./pages/EntityDetail";
import EntityList from "./pages/EntityList";
import Install from "./pages/Install";

export default function App() {
  return (
    <div className="app">
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/c/build" replace />} />
          <Route path="/install" element={<Install />} />
          <Route path="/c/:companion" element={<CompanionRoute />} />
          <Route path="/c/:companion/runs" element={<EntityList />} />
          <Route path="/c/:companion/new" element={<NewEntity />} />
          <Route path="/c/:companion/:id" element={<EntityDetail />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Update `CompanionRoute` to render the new About**

Replace `src/client/pages/CompanionRoute.tsx`:

```tsx
import { useParams } from "react-router-dom";
import { useCompanions } from "../hooks/useCompanions";
import CompanionAbout from "./CompanionAbout";

export default function CompanionRoute() {
  const { companion } = useParams<{ companion: string }>();
  const { companions, loading } = useCompanions();
  if (loading) return <div style={{ color: "var(--muted)" }}>Loading…</div>;
  const manifest = companions.find((c) => c.name === companion);
  if (!manifest) return <div style={{ color: "#dc2626" }}>Unknown companion: {companion}</div>;
  // Both entity and tool kinds now use the unified About page.
  return <CompanionAbout />;
}
```

The `ToolAbout.tsx` file's "Try it" panel functionality should be preserved. Add the Try-it panel from `ToolAbout` into `CompanionAbout` for tool-kind companions:

In `src/client/pages/CompanionAbout.tsx`, import the `TryIt` component (move it from `ToolAbout.tsx` to a shared location or re-export it). Modify the bottom of the rendered JSX:

```tsx
// Add import at top:
// (move the TryIt function from ToolAbout.tsx into CompanionAbout.tsx, or extract to a new file)

// Add at end of JSX, before closing </div>:
{manifest.kind === "tool" && payload.tools.length > 0 && (
  <TryIt companion={companion} tools={payload.tools} />
)}
```

The simplest path: copy the `TryIt` function and `ToolDescriptor` interface inline into `CompanionAbout.tsx`. Alternatively, leave `ToolAbout.tsx` unchanged and route tool kind to `ToolAbout` while entity kind goes to `CompanionAbout`. **Choosing the second option** for minimal diff:

Replace `CompanionRoute.tsx` with:

```tsx
import { useParams } from "react-router-dom";
import { useCompanions } from "../hooks/useCompanions";
import CompanionAbout from "./CompanionAbout";
import ToolAbout from "./ToolAbout";

export default function CompanionRoute() {
  const { companion } = useParams<{ companion: string }>();
  const { companions, loading } = useCompanions();
  if (loading) return <div style={{ color: "var(--muted)" }}>Loading…</div>;
  const manifest = companions.find((c) => c.name === companion);
  if (!manifest) return <div style={{ color: "#dc2626" }}>Unknown companion: {companion}</div>;
  return manifest.kind === "tool" ? <ToolAbout /> : <CompanionAbout />;
}
```

- [ ] **Step 3: Verify Sidebar links still target `/c/:name`**

Read `src/client/components/Sidebar.tsx`:

Run: `grep -n 'to=' src/client/components/Sidebar.tsx`
Expected: links point to `/c/<name>` already. No change needed unless the sidebar special-cases List vs About.

- [ ] **Step 4: Update existing test that expected EntityList to render at /c/:name**

Search for tests that assume the old behavior:

Run: `grep -rn 'CompanionRoute\|EntityList' tests/client/`
Expected: identify any tests using `MemoryRouter initialEntries={["/c/<name>"]}` that expect List behavior.

If any exist, update them to use `/c/<name>/runs` instead. The most likely candidate is `tests/client/EntityList.test.tsx` — confirm by reading it. If it uses `<EntityList>` directly (not via routing), no change needed.

- [ ] **Step 5: Run all tests**

Run: `npm test -- --run`
Expected: all pass.

- [ ] **Step 6: Smoke test in browser**

Run: `npm run build && PORT=3001 npm start &`
Then open `http://localhost:3001`, click on Build sidebar item — should land on the About page (manifest header, list of tools, "Start a new run" button, "View runs" button).
Click "View runs" — should land on EntityList at `/c/build/runs`.
Click "Start a new run" — should land on NewEntity at `/c/build/new`.

Kill background process: `pkill -f "node.*dist"` or whatever PID was returned.

- [ ] **Step 7: Commit**

```bash
git add src/client/App.tsx src/client/pages/CompanionRoute.tsx
git commit -m "feat(client): About page is default landing for /c/:name; List moves to /c/:name/runs"
```

---

## Phase 4 — Skill Templates

### Task 13: Update entity skill template

**Files:**
- Modify: `companions/build/templates/skill.md`

- [ ] **Step 1: Replace skill template with comprehensive version**

Replace `companions/build/templates/skill.md` entirely:

```markdown
---
name: __NAME__-companion
description: Use when the user pastes "/__NAME__-companion <entity-id>" — runs the __NAME__ companion against one of its pending entities.
---

# /__NAME__-companion <entity-id>

Execute one __NAME__ entity to completion.

> **CRITICAL — MCP tools ONLY:**
> - Use the MCP tools prefixed `mcp__claudepanion__` for ALL state changes (status, logs, artifact, failure).
> - NEVER curl the REST API at `/api/entities/*` to mutate state.
> - NEVER edit `data/__NAME__/<id>.json` directly.
> - If an MCP tool returns an error, call `mcp__claudepanion__`__NAME___fail`` and stop. Do NOT fall back to HTTP.
> - If `mcp__claudepanion__` tools are not available in your session, stop and tell the user to verify `claudepanion plugin install` and that the server is running, then start a new Claude Code session.

## Step 1 — Load the entity

```
mcp__claudepanion__`__NAME___get`({ id: "<entity-id>" })
```

If the call errors or the entity is missing, stop.

### Step 1.5 — Detect continuation

If `entity.artifact !== null`, this is a continuation — the user clicked "Continue" on a previously completed run. Read the prior artifact carefully before doing new work. Use updated `entity.input` fields as the user's redirection. Log:

```
mcp__claudepanion__`__NAME___append_log`({ id: "<entity-id>", message: "Continuing from prior run — reading previous artifact" })
```

Produce a complete, updated artifact when you save (not a diff).

## Step 2 — Preflight check

Verify the companion's required env vars are set:

```bash
curl -s http://localhost:3001/api/companions/__NAME__/preflight
```

If the response shows `missingRequired` non-empty:

```
mcp__claudepanion__`__NAME___fail`({ id: "<entity-id>", errorMessage: "[config] missing env vars: <list>" })
```

and stop.

## Step 3 — Mark running

```
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "running", statusMessage: "starting" })
```

## Step 4 — Do the work

__DESCRIPTION__

### 4a — Call domain proxy tools for external system access

If this companion has domain proxy tools (defined in `companions/__NAME__/server/tools.ts`), call them to access external systems. These are your primary data source.

```
mcp__claudepanion__`__NAME___<verb>`({ id: "<entity-id>", ... })
```

After each proxy tool call, log what you received:

```
mcp__claudepanion__`__NAME___append_log`({ id: "<entity-id>", message: "fetched 47 records from <source>" })
```

### 4b — Use Claude's built-in tools for local work (optional)

Use Read, Grep, Bash, and Edit for local file or repository access.

Stream progress after each meaningful step:

```
mcp__claudepanion__`__NAME___append_log`({ id: "<entity-id>", message: "<what you just did>" })
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "running", statusMessage: "<current phase>" })
```

### 4c — Write actions require user permission

If a proxy tool has `sideEffect: "write"` (changes state in an external system), you MUST ask the user before calling it:

1. Show the proposed write content in chat ("Here's the review I'd post to GitHub: …")
2. Ask: "Should I post this?"
3. Wait for confirmation
4. Only call the write tool if confirmed
5. If declined, save the artifact with `errors: ["user declined write action"]` and proceed to Step 5

Never call a write tool without explicit user permission.

## Step 5 — Save the artifact

The artifact shape is defined by `__PASCAL__Artifact` in `companions/__NAME__/types.ts`. It extends `BaseArtifact` so it may include `summary?: string` and `errors?: string[]`:

```
mcp__claudepanion__`__NAME___save_artifact`({
  id: "<entity-id>",
  artifact: {
    summary: "<one-line outcome>",
    errors: [<any [recoverable] errors logged during the run>],
    // ... your custom artifact fields
  }
})
```

## Step 6 — Complete

```
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "completed" })
```

## Error handling

When a proxy tool returns an error, branch on the prefix:

| Prefix | Action |
|---|---|
| `[config]` | Call `__NAME___fail` with the error message and stop |
| `[input]` | Call `__NAME___fail` with the error message and stop |
| `[transient]` | Log warn, retry the tool ONCE; if still failing, call `__NAME___fail` |
| `[recoverable]` | Log warn, continue; add the message to the artifact's `errors[]` field |
| (no prefix) | Treat as fatal: call `__NAME___fail` |

For example:

```
const result = mcp__claudepanion__`__NAME___fetch_thing`({...})
if (result.isError) {
  if (result.content[0].text.startsWith("[transient]")) {
    // log warn, retry once
  } else if (result.content[0].text.startsWith("[recoverable]")) {
    // log warn, add to artifact.errors, continue
  } else {
    mcp__claudepanion__`__NAME___fail`({ id, errorMessage: result.content[0].text })
    // stop
  }
}
```

## On unrecoverable error at any step

```
mcp__claudepanion__`__NAME___fail`({ id: "<entity-id>", errorMessage: "<short cause>", errorStack: "<optional stack>" })
```
```

- [ ] **Step 2: Run all tests to verify nothing broke**

Run: `npm test -- --run`
Expected: all pass (template changes don't affect runtime tests).

- [ ] **Step 3: Commit**

```bash
git add companions/build/templates/skill.md
git commit -m "feat(templates): entity skill template — continuation, preflight, error handling, write permission patterns"
```

### Task 14: Update Build skill — read-only bias

**Files:**
- Modify: `skills/build-companion/SKILL.md`

- [ ] **Step 1: Add read-only bias section**

Open `skills/build-companion/SKILL.md` and find Step 2 ("Validate + resolve substitution tokens") under Mode: new-companion.

Add a new step **Step 2.5 — Interpret request: read-only by default** between Step 2 and Step 3:

```markdown
### Step 2.5 — Interpret the user's request: read-only by default

Read `entity.input.description` and decide what proxy tools to scaffold. Apply this rule:

> **Default to read-only proxy tools unless the user explicitly requests write actions.**

| User wrote… | Action |
|---|---|
| "review PRs", "investigate logs", "check Linear", "summarize Slack" | Scaffold READ-only tools |
| "post a review", "update a ticket", "send a message", "create an alarm" | Scaffold READ tools + the explicitly-requested WRITE tools |
| Vague description ("PR helper", "incident tool") | Default to READ-only |

When you scaffold write tools, set `sideEffect: "write"` on them. The host's About page will surface a warning, and the entity skill template's Step 4c will require user permission before each call.

When you scaffold read-only tools, omit `sideEffect` (defaults to `"read"`).

If the description mentions an external system (GitHub, AWS, Linear, Slack, etc.), add the relevant env var to the manifest's `requiredEnv`:

| Service | Env var |
|---|---|
| GitHub API | `GITHUB_TOKEN` |
| AWS SDK | (none — uses `~/.aws/credentials`; profile passed as tool arg) |
| Linear API | `LINEAR_API_KEY` |
| Slack API | `SLACK_BOT_TOKEN` |
| OpenAI API | `OPENAI_API_KEY` |

Log:

```
mcp__claudepanion__build_append_log({ id: "<entity-id>", message: "interpreted as <read-only|with-write> companion using <external-system>" })
```
```

- [ ] **Step 2: Run all tests**

Run: `npm test -- --run`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add skills/build-companion/SKILL.md
git commit -m "feat(build-skill): read-only bias when interpreting vague descriptions"
```

### Task 15: Update entity tools template comment

**Files:**
- Modify: `companions/build/templates/entity/server/tools.ts`

- [ ] **Step 1: Update template with sideEffect example**

Replace `companions/build/templates/entity/server/tools.ts`:

```ts
import { z } from "zod";
import type { CompanionToolDefinition } from "../../../src/shared/types.js";
import { successResult, errorResult, configErrorResult, transientErrorResult } from "../../../src/shared/types.js";

// Domain proxy tools for __NAME__.
//
// Each tool calls an external API using locally-stored credentials.
// The host auto-registers the six generic entity tools (_get, _list,
// _update_status, _append_log, _save_artifact, _fail) — don't add them here.
//
// Every tool name must be prefixed "__NAME___".
// Set sideEffect: "write" on tools that change external state — the skill
// will require user permission before each call.

export const tools: CompanionToolDefinition[] = [
  // Read-only example (sideEffect defaults to "read"):
  //
  // {
  //   name: "__NAME___fetch",
  //   description: "Fetch data from the external service.",
  //   schema: {
  //     id: z.string().describe("entity ID"),
  //     query: z.string().describe("query to send to the external API"),
  //   },
  //   async handler({ id, query }: { id: string; query: string }) {
  //     const token = process.env.SERVICE_TOKEN;
  //     if (!token) return configErrorResult("SERVICE_TOKEN", "create a token at example.com/tokens");
  //     try {
  //       const data = await fetch("https://api.example.com/...").then((r) => r.json());
  //       return successResult(data);
  //     } catch (err: any) {
  //       if (err.code === "ECONNREFUSED") return transientErrorResult(`network error: ${err.message}`);
  //       return errorResult(`API error: ${err.message}`);
  //     }
  //   },
  // },
  //
  // Write example (sideEffect: "write" — skill prompts for permission):
  //
  // {
  //   name: "__NAME___create",
  //   description: "Create a new resource. Visible to other users; cannot be deleted.",
  //   schema: { id: z.string(), title: z.string() },
  //   sideEffect: "write",
  //   async handler({ id, title }: { id: string; title: string }) {
  //     // ... call API
  //     return successResult({ ok: true });
  //   },
  // },
];
```

- [ ] **Step 2: Run all tests**

Run: `npm test -- --run`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add companions/build/templates/entity/server/tools.ts
git commit -m "feat(templates): scaffold tools.ts shows read and write patterns with new helpers"
```

### Task 16: Update scaffold spec to mark items shipped

**Files:**
- Modify: `docs/scaffold-spec.md`

- [ ] **Step 1: Update the implementation status table**

In `docs/scaffold-spec.md`, find the implementation status table at the bottom. Update each row that this PR shipped:

```markdown
| 3. Manifest `requiredEnv`/`optionalEnv` | ✅ Shipped |
| 4. Configuration & preflight | ✅ Shipped (endpoint + banner) |
| 5. Form contract | ✅ Shipped (form + preflight banner integration) |
| 7. Skill template | ✅ Shipped (continuation + preflight + error handling + write-permission stanzas) |
| 7d. Continuation contract | ✅ Shipped (skill template stanza) |
| 9e. Write-action safety | ✅ Shipped (sideEffect flag + skill pattern + About warning) |
| 10. Error handling helpers | ✅ Shipped (configErrorResult/inputErrorResult/transientErrorResult) |
| 10. Skill error pattern | ✅ Shipped (template additions) |
| 10. Artifact `errors[]` convention | ✅ Shipped (BaseArtifact + BaseArtifactPanel) |
| 11. Artifact rendering | ✅ Shipped (BaseArtifactPanel wrapper) |
| 11.5. BaseArtifact interface | ✅ Shipped |
| 12c. About page (entity kind) | ✅ Shipped (CompanionAbout) |
| 13d. External dependencies | ✅ Convention documented |
| 14. Validator / smoke / watcher | ✅ Shipped (validator accepts new manifest fields) |
```

Replace the "Foundation work to land before chip examples" section with:

```markdown
**Foundation shipped:** Phase 1–4 of `docs/superpowers/plans/2026-04-25-scaffold-foundation.md` complete.

**Remaining for chip examples:**

1. Build's first read-only proxy companion (e.g., GitHub PR reviewer) using the new primitives
2. End-to-end verification — scaffold a companion with `requiredEnv`, run preflight check, verify About page rendering, simulate a run with a recoverable error
```

Also add a new subsection §11.5 about `BaseArtifact` between §11a (Artifact type) and §11b (Detail rendering):

```markdown
### 11.5. The `BaseArtifact` interface

Every companion's artifact type should extend `BaseArtifact`:

```ts
export interface BaseArtifact {
  /** Short one-liner describing the run's outcome. Shown in List row + Detail header. */
  summary?: string;
  /** Recoverable issues during the run. Rendered as "Notes during this run" by the host. */
  errors?: string[];
}
```

The host wraps every Detail page renderer in `<BaseArtifactPanel>` which automatically renders `summary` (top banner) and `errors[]` (bottom section). Companion authors only render their domain-specific middle content.

Companions can make `summary` required by overriding the type in the extended interface (e.g., `BuildArtifact.summary: string`).
```

- [ ] **Step 2: Commit**

```bash
git add docs/scaffold-spec.md
git commit -m "docs: scaffold spec reflects foundation shipped; BaseArtifact section added"
```

---

## Final verification

### Task 17: End-to-end smoke test

- [ ] **Step 1: Build and run the server**

```bash
npm run build
PORT=3001 npm start &
sleep 3
```

- [ ] **Step 2: Verify endpoints**

```bash
# Build companion has no requiredEnv, so preflight should be ok:true
curl -s http://localhost:3001/api/companions/build/preflight | jq
# Expected: { "ok": true, "missingRequired": [], "missingOptional": [] }

# Tools endpoint includes sideEffect (currently empty array for build's tools)
curl -s http://localhost:3001/api/tools/build | jq
# Expected: 400 (build is entity kind), or tools array with sideEffect on each
```

- [ ] **Step 3: Verify UI**

Open `http://localhost:3001` in browser:
- Default landing → About page for build
- Click "Start a new run" → form renders with no preflight banner (no requiredEnv)
- Submit a Build form → goes to detail page, slash command shown
- (Manual) Run the slash command in Claude Code, verify the new skill template steps work end-to-end

- [ ] **Step 4: Stop the server**

```bash
pkill -f "node.*dist/src/server"
```

- [ ] **Step 5: Run full test suite**

```bash
npm test -- --run && npm run check && npm run build
```

Expected: all green.

- [ ] **Step 6: Push the branch**

```bash
git push -u origin feat/scaffold-foundation
```

- [ ] **Step 7: Open PR**

```bash
gh pr create --title "Scaffold foundation: preflight, error helpers, BaseArtifact, About page, write-action safety" --body "$(cat <<'EOF'
## Summary

Foundation primitives for proxy companions, satisfying `docs/scaffold-spec.md`.

- **Manifest `requiredEnv` / `optionalEnv`** — companions declare their env-var dependencies
- **`GET /api/companions/:name/preflight`** — generic config-readiness check
- **`<PreflightBanner>`** — auto-renders blocking/soft banners on the New Entity form (and About page)
- **Error helpers** — `configErrorResult`, `inputErrorResult`, `transientErrorResult` standardize the four error classes
- **`CompanionToolDefinition.sideEffect`** — `"read" | "write"` flag drives About page warnings and skill permission flow
- **`BaseArtifact`** — common artifact fields (`summary?`, `errors?`) with `<BaseArtifactPanel>` doing generic rendering
- **`<CompanionAbout>` page** — default landing at `/c/:name`; List moves to `/c/:name/runs`
- **Skill template updates** — continuation detection, preflight check, four-class error handling, write-permission stanza
- **Build skill read-only bias** — when interpreting vague descriptions, default to read-only

## Test plan

- [ ] All vitest tests pass (`npm test`)
- [ ] Typecheck passes (`npm run check`)
- [ ] Build passes (`npm run build`)
- [ ] Manual: open http://localhost:3001, verify About page is the default landing
- [ ] Manual: scaffold a Build run, verify the new skill template steps work in Claude Code

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:** Phase 1 covers manifest fields, sideEffect, BaseArtifact, helpers. Phase 2 covers preflight + banner. Phase 3 covers About page, BaseArtifactPanel, routing. Phase 4 covers skill template + Build bias. All ✅ items in the spec's implementation status table are covered.

**Type consistency:** `PreflightStatus` defined once in `usePreflight.ts`; `BaseArtifact` defined once in `shared/types.ts`; `BuildArtifact extends BaseArtifact`; all components consistently reference the same interfaces.

**Test commands:** `npm test -- --run` runs full suite; `npx vitest run <path>` runs targeted tests. Both work in this codebase.
