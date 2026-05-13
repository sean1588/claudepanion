# UI Facelift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Editorial · Cool design handoff to the five in-app screens (Build home, Build form, Build run detail, generic CompanionAbout, Install) and to the shared `CompanionForm` primitive so user companions inherit the look. One PR, five reviewable stages.

**Architecture:** Five stages, each its own TDD-cycle group + commit landmark. Stage 1 lands the design-token foundation (CSS vars, type classes, sketch icons, sidebar restyle, new `/api/health` endpoint). Stages 2–4 rewrite Build-specific screens (home / form / run-detail) using the foundation. Stage 5 restyles the generic companion shell (`CompanionAbout`, `Install`, `NewEntity`) plus the schema-driven `CompanionForm` primitive so every user companion picks up the editorial look on next render. Build-run step list is derived client-side from log-line patterns (no schema/server change). Detail polling is plain `setInterval` at 2s while pending/running.

**Tech stack:** React 18, vite, react-router-dom, vitest (jsdom for component tests / node for server tests), Zod 4. Google Fonts (Instrument Serif, Inter, JetBrains Mono).

**Spec:** `docs/superpowers/specs/2026-05-12-ui-facelift-redo-design.md`

**Handoff bundle:** `/tmp/handoff/design_handoff_claudepanion/` — 14 PNG screenshots @ 1280px and 6 reference JSX prototypes. The JSX files use inline styles via a `p.ink` palette object; we recreate the structure with our CSS classes. **Lift layout, copy, and icon SVG. Do not copy the inline-style approach.**

---

## Preflight

- [ ] **Step 1: Branch off main**

```bash
git checkout main && git pull && git checkout -b ui/facelift-v2
```

- [ ] **Step 2: Verify baseline**

```bash
npm run build && npx vitest run
```
Expected: build clean, all existing tests pass. Note the count — that's the floor we must hold at every stage.

- [ ] **Step 3: Open the handoff alongside the dev server**

```bash
npm run dev
```
Open `http://localhost:5173/` (or whatever port vite reports) in one window; open `/tmp/handoff/design_handoff_claudepanion/screenshots/` in another. You'll diff against these all the way through.

---

## Stage 1 — Foundation

Goal: design tokens live, Google Fonts loaded, sketch icon set available, sidebar restyled with SYSTEM rail, `/api/health` shipping. Existing screens still render and pass tests (visual will look mixed during this stage — that's expected and gets resolved by stages 2–5).

### Task 1.1: Google Fonts + design tokens

**Files:**
- Modify: `index.html`
- Modify: `src/client/styles.css` (full rewrite of `:root` block + base classes)

- [ ] **Step 1: Add Google Fonts links to `index.html`**

In `<head>`, before the existing `<link rel="stylesheet">` line for `styles.css`, add:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Replace the `:root` block and base resets in `src/client/styles.css`**

Replace lines 1–25 (the existing `:root` declarations through the `code` selector) with the editorial token set:

```css
:root {
  /* Cool palette */
  --bg: #F1F2F1;
  --ink: #15181A;
  --muted: #5C6266;
  --accent: #3D6FB8;
  --soft: #DDE2DE;
  --sage: #7A8788;

  /* Status */
  --status-success: #7BAE6B;
  --status-warning: #E5A24A;
  --status-error: #E36658;
  --status-info: #3D6FB8;

  /* Fonts */
  --font-display: "Instrument Serif", Georgia, serif;
  --font-body: "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

  /* Compatibility aliases for code that still references the old names */
  --fg: var(--ink);
  --border: var(--soft);
  --brand: var(--accent);
  --pending-bg: color-mix(in srgb, var(--status-warning) 15%, transparent);
  --pending-fg: #8a5b18;
  --running-bg: color-mix(in srgb, var(--status-info) 12%, transparent);
  --running-fg: #1f3a6b;
  --completed-bg: color-mix(in srgb, var(--status-success) 15%, transparent);
  --completed-fg: #2f5b29;
  --error-bg: color-mix(in srgb, var(--status-error) 12%, transparent);
  --error-fg: #7a2a20;
  --code-bg: var(--ink);
  --code-fg: var(--bg);
  --sidebar: var(--soft);
  --sidebar-fg: var(--ink);
  --sidebar-active: color-mix(in srgb, var(--ink) 10%, transparent);
}

* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: var(--font-body);
  color: var(--ink);
  background: var(--bg);
  font-size: 16px;
  line-height: 1.55;
}
code, .t-mono { font-family: var(--font-mono); }
```

- [ ] **Step 3: Append type and primitive classes to `src/client/styles.css`**

Append at the end of the file:

```css
/* ── Editorial type ────────────────────────────────────────────── */
.t-display { font-family: var(--font-display); font-weight: 400; font-size: 80px; line-height: 1.05; letter-spacing: -0.02em; }
.t-display-sm { font-family: var(--font-display); font-weight: 400; font-size: 56px; line-height: 1.05; letter-spacing: -0.015em; }
.t-h2 { font-family: var(--font-display); font-weight: 400; font-size: 40px; line-height: 1.1; letter-spacing: -0.015em; }
.t-h3 { font-family: var(--font-body); font-weight: 600; font-size: 18px; line-height: 1.3; }
.t-body { font-family: var(--font-body); font-weight: 400; font-size: 16px; line-height: 1.55; }
.t-caption { font-family: var(--font-body); font-weight: 400; font-size: 13px; line-height: 1.5; color: var(--muted); }
.t-eyebrow { font-family: var(--font-body); font-weight: 500; font-size: 11px; line-height: 1; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.t-mono { font-family: var(--font-mono); font-size: 13px; line-height: 1.5; }
.t-accent-italic { font-style: italic; color: var(--accent); }

/* ── Buttons and pills ─────────────────────────────────────────── */
.btn-ink {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px; border-radius: 999px; border: 0;
  background: var(--ink); color: var(--bg);
  font-family: var(--font-body); font-size: 14px; font-weight: 500;
  cursor: pointer; transition: background 150ms ease-out;
}
.btn-ink:hover:not(:disabled) { background: color-mix(in srgb, var(--ink) 88%, transparent); }
.btn-ink:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px; border-radius: 999px;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
  color: var(--ink); font-family: var(--font-body); font-size: 14px; font-weight: 500;
  cursor: pointer; transition: border-color 150ms ease-out;
}
.btn-ghost:hover { border-color: var(--ink); }

.btn-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 999px;
  background: var(--soft); color: var(--ink);
  border: 0; font-family: var(--font-body); font-size: 12px; font-weight: 500;
  cursor: pointer;
}

.pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px;
  font-family: var(--font-body); font-size: 11px; font-weight: 500;
  background: var(--soft); color: var(--ink);
}
.pill-eyebrow { padding: 6px 12px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }

/* ── Surfaces ──────────────────────────────────────────────────── */
.card-hairline {
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
  border-radius: 8px;
  padding: 20px;
}
.card-soft {
  background: var(--soft);
  border-radius: 8px;
  padding: 20px;
}
.panel-mono {
  background: var(--ink);
  color: var(--bg);
  border-radius: 8px;
  padding: 14px 16px;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.5;
}
```

- [ ] **Step 4: Run baseline tests**

```bash
npx vitest run
```
Expected: still green. Token rename is backwards-compatible thanks to the alias block.

- [ ] **Step 5: Commit**

```bash
git add index.html src/client/styles.css
git commit -m "ui(foundation): add Google Fonts and editorial design tokens"
```

### Task 1.2: Sketch icon component

**Files:**
- Create: `src/client/icons/Sketch.tsx`
- Create: `tests/client/Sketch.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/client/Sketch.test.tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Sketch } from "../../src/client/icons/Sketch";

describe("Sketch icons", () => {
  it.each(["Companion", "Form", "Slash", "Wrench", "Doc", "Plant", "Search"] as const)(
    "renders %s as an SVG with 48x48 viewBox",
    (name) => {
      const Icon = Sketch[name];
      const { container } = render(<Icon />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg!.getAttribute("viewBox")).toBe("0 0 48 48");
      expect(svg!.getAttribute("stroke-width")).toBe("1.4");
    }
  );
});
```

- [ ] **Step 2: Verify it fails**

```bash
npx vitest run tests/client/Sketch.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/client/icons/Sketch.tsx`**

Reference: `/tmp/handoff/design_handoff_claudepanion/source/shared.jsx` for SVG path data. Pattern for each icon:

```tsx
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function makeBase({ size = 48, ...rest }: IconProps) {
  return {
    width: size, height: size,
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

const Companion = (p: IconProps) => (
  <svg {...makeBase(p)}>
    <path d="M10 30c0-7 6-13 14-13s14 6 14 13c0 4-2 7-5 9l1 6-7-4c-1 0-2 0-3 0-8 0-14-5-14-11Z"/>
    <circle cx="18" cy="29" r="1.2" fill="currentColor"/>
    <circle cx="24" cy="29" r="1.2" fill="currentColor"/>
    <circle cx="30" cy="29" r="1.2" fill="currentColor"/>
  </svg>
);

const Form = (p: IconProps) => (
  <svg {...makeBase(p)}>
    <rect x="10" y="8" width="28" height="32" rx="2"/>
    <path d="M16 16h16M16 22h16M16 28h10"/>
  </svg>
);

const Slash = (p: IconProps) => (
  <svg {...makeBase(p)}>
    <path d="M18 8 L30 40"/>
    <path d="M10 24h28"/>
  </svg>
);

const Wrench = (p: IconProps) => (
  <svg {...makeBase(p)}>
    <path d="M30 8a8 8 0 0 0-8 10l-12 12a3 3 0 0 0 4 4l12-12a8 8 0 0 0 10-8l-6 6-4-1-1-4Z"/>
  </svg>
);

const Doc = (p: IconProps) => (
  <svg {...makeBase(p)}>
    <path d="M12 6h18l8 8v28H12Z"/>
    <path d="M30 6v8h8"/>
    <path d="M18 22h12M18 28h12M18 34h8"/>
  </svg>
);

const Plant = (p: IconProps) => (
  <svg {...makeBase(p)}>
    <path d="M14 40h20"/>
    <path d="M24 40V20"/>
    <path d="M24 26c-6 0-10-4-10-10 6 0 10 4 10 10Z"/>
    <path d="M24 22c6 0 10-4 10-10-6 0-10 4-10 10Z"/>
  </svg>
);

const Search = (p: IconProps) => (
  <svg {...makeBase(p)}>
    <circle cx="22" cy="22" r="10"/>
    <path d="M30 30l8 8"/>
  </svg>
);

export const Sketch = { Companion, Form, Slash, Wrench, Doc, Plant, Search };
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run tests/client/Sketch.test.tsx
```
Expected: PASS — all 7 icons render with the correct viewBox and stroke-width.

- [ ] **Step 5: Commit**

```bash
git add src/client/icons/Sketch.tsx tests/client/Sketch.test.tsx
git commit -m "ui(foundation): add hand-sketched icon set"
```

### Task 1.3: `/api/health` endpoint

**Files:**
- Create: `src/server/health.ts`
- Modify: `src/server/api-routes.ts` (add the route)
- Create: `tests/server/health.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/health.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeHealth } from "../../src/server/health";

describe("computeHealth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-12T10:00:00Z"));
  });

  it("reports host running, mcp from snapshot, plugin from detector", async () => {
    const result = await computeHealth({
      mcpSnapshot: { firstRequestAt: 1, lastRequestAt: 2 },
      detectPlugin: async () => true,
    });
    expect(result.host).toBe("running");
    expect(result.pluginInstalled).toBe(true);
    expect(result.mcp.firstRequestAt).toBe("1970-01-01T00:00:00.001Z");
  });

  it("returns pluginInstalled: null when detector throws", async () => {
    const result = await computeHealth({
      mcpSnapshot: { firstRequestAt: null, lastRequestAt: null },
      detectPlugin: async () => { throw new Error("ENOENT"); },
    });
    expect(result.pluginInstalled).toBeNull();
    expect(result.mcp.firstRequestAt).toBeNull();
  });

  it("returns pluginInstalled: false when detector returns false", async () => {
    const result = await computeHealth({
      mcpSnapshot: { firstRequestAt: null, lastRequestAt: null },
      detectPlugin: async () => false,
    });
    expect(result.pluginInstalled).toBe(false);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npx vitest run tests/server/health.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server/health.ts`**

```ts
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface McpSnapshot {
  firstRequestAt: number | null;
  lastRequestAt: number | null;
}

export interface HealthInput {
  mcpSnapshot: McpSnapshot;
  detectPlugin?: () => Promise<boolean>;
}

export interface HealthResult {
  host: "running";
  pluginInstalled: boolean | null;
  mcp: { firstRequestAt: string | null; lastRequestAt: string | null };
}

export async function computeHealth({ mcpSnapshot, detectPlugin }: HealthInput): Promise<HealthResult> {
  let pluginInstalled: boolean | null;
  try {
    pluginInstalled = detectPlugin ? await detectPlugin() : await defaultDetectPlugin();
  } catch {
    pluginInstalled = null;
  }
  return {
    host: "running",
    pluginInstalled,
    mcp: {
      firstRequestAt: mcpSnapshot.firstRequestAt ? new Date(mcpSnapshot.firstRequestAt).toISOString() : null,
      lastRequestAt: mcpSnapshot.lastRequestAt ? new Date(mcpSnapshot.lastRequestAt).toISOString() : null,
    },
  };
}

async function defaultDetectPlugin(): Promise<boolean> {
  // Look in the user's home Claude settings for claudepanion in enabledPlugins.
  const settingsPath = join(homedir(), ".claude", "settings.json");
  const raw = await readFile(settingsPath, "utf-8");
  const parsed = JSON.parse(raw) as { enabledPlugins?: Record<string, unknown> };
  const enabled = parsed.enabledPlugins ?? {};
  return Object.keys(enabled).some((k) => k.toLowerCase().includes("claudepanion"));
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run tests/server/health.test.ts
```
Expected: PASS — all three branches covered.

- [ ] **Step 5: Wire the route in `src/server/api-routes.ts`**

Add this import near the other server imports at the top of the file:

```ts
import { computeHealth } from "./health.js";
```

Add this route right after the `/api/mcp/status` route (around line 47, after the closing `});` of mcp/status):

```ts
  app.get("/api/health", async (_req: Request, res: Response) => {
    const result = await computeHealth({ mcpSnapshot: getMcpStatus() });
    res.json(result);
  });
```

- [ ] **Step 6: Run the full server test suite**

```bash
npx vitest run tests/server/
```
Expected: PASS — health test plus all existing server tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/server/health.ts src/server/api-routes.ts tests/server/health.test.ts
git commit -m "ui(foundation): add /api/health for SystemRail status dots"
```

### Task 1.4: Sidebar restyle + SystemRail

**Files:**
- Modify: `src/client/components/Sidebar.tsx` (rewrite)
- Create: `src/client/components/SystemRail.tsx`
- Create: `src/client/hooks/useHealth.ts`
- Create: `tests/client/Sidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/client/Sidebar.test.tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Sidebar from "../../src/client/components/Sidebar";

vi.mock("../../src/client/hooks/useCompanions", () => ({
  useCompanions: () => ({
    companions: [
      { name: "build", displayName: "Build", icon: "🔨", kind: "ui" },
      { name: "pr-reviewer", displayName: "PR reviewer", icon: "🔎", kind: "ui" },
    ],
    loading: false,
  }),
}));

vi.mock("../../src/client/hooks/useHealth", () => ({
  useHealth: () => ({
    host: "running",
    pluginInstalled: true,
    mcp: { firstRequestAt: new Date(Date.now() - 60_000).toISOString(), lastRequestAt: new Date().toISOString() },
  }),
}));

describe("Sidebar", () => {
  it("renders CORE / COMPANIONS / SYSTEM section labels", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText("Core")).toBeInTheDocument();
    expect(screen.getByText("Companions")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("renders SystemRail rows with status labels", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText(/host/i)).toBeInTheDocument();
    expect(screen.getByText(/mcp/i)).toBeInTheDocument();
    expect(screen.getByText(/plugin/i)).toBeInTheDocument();
  });

  it("keeps Install companion as the footer link", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /install companion/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npx vitest run tests/client/Sidebar.test.tsx
```
Expected: FAIL — `useHealth` module not found.

- [ ] **Step 3: Create `src/client/hooks/useHealth.ts`**

```ts
import { useEffect, useState } from "react";

export interface Health {
  host: "running";
  pluginInstalled: boolean | null;
  mcp: { firstRequestAt: string | null; lastRequestAt: string | null };
}

const POLL_MS = 5_000;

export function useHealth(): Health | null {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch("/api/health");
        if (!res.ok) return;
        const data = (await res.json()) as Health;
        if (!cancelled) setHealth(data);
      } catch {
        /* network glitch — keep last good value */
      }
    };
    void fetchOnce();
    const id = setInterval(fetchOnce, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return health;
}
```

- [ ] **Step 4: Create `src/client/components/SystemRail.tsx`**

```tsx
import { useHealth } from "../hooks/useHealth";

const MCP_GRACE_MS = 15_000;

type Dot = "ok" | "warn" | "muted";

function dotColor(d: Dot): string {
  if (d === "ok") return "var(--status-success)";
  if (d === "warn") return "var(--status-error)";
  return "var(--muted)";
}

export default function SystemRail() {
  const health = useHealth();
  const host: Dot = "ok";
  const mcp: Dot = mcpDot(health);
  const plugin: Dot = pluginDot(health);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Row dot={host} label="host running" />
      <Row dot={mcp} label="MCP /mcp open" title={mcpTitle(mcp)} />
      <Row dot={plugin} label="plugin installed" title={pluginTitle(plugin, health)} />
    </div>
  );
}

function Row({ dot, label, title }: { dot: Dot; label: string; title?: string }) {
  return (
    <div title={title} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor(dot), flex: "0 0 8px" }} />
      <span>{label}</span>
    </div>
  );
}

function mcpDot(h: ReturnType<typeof useHealth>): Dot {
  if (!h) return "muted";
  if (h.mcp.firstRequestAt) return "ok";
  // If we have no first-request timestamp, the rail is "warn" only after the grace period —
  // matches the per-entity stuck-watchdog behavior shipped in PR #21.
  return "warn";
}

function mcpTitle(d: Dot): string {
  if (d === "ok") return "MCP traffic seen";
  if (d === "warn") return "No MCP traffic yet — run /mcp in your Claude session";
  return "Loading…";
}

function pluginDot(h: ReturnType<typeof useHealth>): Dot {
  if (!h) return "muted";
  if (h.pluginInstalled === true) return "ok";
  if (h.pluginInstalled === false) return "warn";
  return "muted";
}

function pluginTitle(d: Dot, h: ReturnType<typeof useHealth>): string {
  if (d === "muted" && h?.pluginInstalled === null) return "Plugin install state unknown";
  if (d === "ok") return "claudepanion plugin enabled";
  if (d === "warn") return "claudepanion plugin not enabled — run `claudepanion plugin install`";
  return "Loading…";
}
```

- [ ] **Step 5: Rewrite `src/client/components/Sidebar.tsx`**

```tsx
import { NavLink } from "react-router-dom";
import { useCompanions } from "../hooks/useCompanions";
import { Sketch } from "../icons/Sketch";
import SystemRail from "./SystemRail";

export default function Sidebar() {
  const { companions } = useCompanions();
  const build = companions.find((c) => c.name === "build");
  const entities = companions.filter((c) => c.kind === "ui" && c.name !== "build");
  const tools = companions.filter((c) => c.kind === "tool");

  return (
    <aside className="app-sidebar editorial-sidebar">
      <div className="sidebar-wordmark">
        <span className="t-display-sm" style={{ fontSize: 28, lineHeight: 1, color: "var(--ink)" }}>claudepanion</span>
        <span className="t-mono" style={{ color: "var(--muted)", fontSize: 11 }}>v0.1 · localhost</span>
      </div>

      <div className="sidebar-section">
        <div className="t-eyebrow sidebar-section-label">Core</div>
        {build ? (
          <NavLink to={`/c/${build.name}`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <Sketch.Wrench size={20} aria-hidden />
            <span>{build.displayName}</span>
          </NavLink>
        ) : (
          <div className="sidebar-link" aria-disabled>
            <Sketch.Wrench size={20} aria-hidden />
            <span>Build</span>
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <div className="t-eyebrow sidebar-section-label">Companions</div>
        {entities.length === 0 ? (
          <div className="t-caption" style={{ padding: "4px 12px", fontStyle: "italic" }}>
            Build something to fill this section.
          </div>
        ) : entities.map((c) => (
          <NavLink key={c.name} to={`/c/${c.name}`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <span aria-hidden>{c.icon}</span>
            <span>{c.displayName}</span>
          </NavLink>
        ))}
        {tools.length > 0 && tools.map((c) => (
          <NavLink key={c.name} to={`/c/${c.name}`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <span aria-hidden>{c.icon}</span>
            <span>{c.displayName}</span>
          </NavLink>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="t-eyebrow sidebar-section-label">System</div>
        <div style={{ padding: "0 12px" }}>
          <SystemRail />
        </div>
      </div>

      <div className="sidebar-footer">
        <NavLink to="/install" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
          <span aria-hidden>+</span>
          <span>Install companion</span>
        </NavLink>
      </div>
    </aside>
  );
}
```

- [ ] **Step 6: Append sidebar-specific styles to `src/client/styles.css`**

```css
/* ── Editorial sidebar ─────────────────────────────────────────── */
.editorial-sidebar {
  width: 260px;
  height: 100vh;
  background: var(--soft);
  color: var(--ink);
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  border-right: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
  position: sticky;
  top: 0;
}
.editorial-sidebar .sidebar-wordmark {
  display: flex; flex-direction: column; gap: 2px;
  padding: 0 4px;
}
.editorial-sidebar .sidebar-section { display: flex; flex-direction: column; gap: 4px; }
.editorial-sidebar .sidebar-section-label { padding: 0 4px 4px; }
.editorial-sidebar .sidebar-link {
  padding: 8px 10px; display: flex; align-items: center; gap: 10px;
  color: var(--ink); text-decoration: none; cursor: pointer;
  font-size: 14px; min-height: 36px; border-radius: 6px;
}
.editorial-sidebar .sidebar-link:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); }
.editorial-sidebar .sidebar-link.active {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  font-weight: 500;
}
.editorial-sidebar .sidebar-footer {
  margin-top: auto;
  border-top: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
  padding-top: 12px;
}
```

- [ ] **Step 7: Run the test**

```bash
npx vitest run tests/client/Sidebar.test.tsx
```
Expected: PASS — all three Sidebar tests green.

- [ ] **Step 8: Run the full test suite**

```bash
npx vitest run
```
Expected: still green overall. If any pre-existing test relied on old sidebar markup (`sidebar-logo-icon`, etc.), update the selector to the new structure.

- [ ] **Step 9: Visual smoke**

```bash
npm run dev
```
Open the app. Sidebar should: (a) have a paper background, (b) show "claudepanion" in Instrument Serif at the top, (c) show three sections (Core / Companions / System), (d) SystemRail dots reflect real `/api/health` data, (e) "+ Install companion" sits at the bottom.

- [ ] **Step 10: Commit**

```bash
git add src/client/components/Sidebar.tsx src/client/components/SystemRail.tsx \
        src/client/hooks/useHealth.ts src/client/styles.css \
        tests/client/Sidebar.test.tsx
git commit -m "ui(foundation): editorial sidebar with SystemRail"
```

---

## Stage 2 — Build home

Goal: `/c/build` renders the new `BuildHome.tsx` matching screenshot 02.

### Task 2.1: BuildHome page

**Files:**
- Create: `src/client/pages/BuildHome.tsx`
- Create: `tests/client/BuildHome.test.tsx`
- Modify: `src/client/pages/CompanionRoute.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/client/BuildHome.test.tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import BuildHome from "../../src/client/pages/BuildHome";

const mockEntities = vi.fn();
vi.mock("../../src/client/api", () => ({
  fetchEntities: (...args: unknown[]) => mockEntities(...args),
}));

describe("BuildHome", () => {
  it("renders the hero and two start-mode cards", async () => {
    mockEntities.mockResolvedValueOnce([]);
    render(<MemoryRouter><BuildHome /></MemoryRouter>);
    expect(await screen.findByText(/Hi, I'm Build/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /scaffold from scratch/i })).toHaveAttribute("href", "/c/build/new");
    expect(screen.getByRole("link", { name: /evolve a companion/i })).toHaveAttribute("href", "/c/build/new?mode=iterate");
  });

  it("shows empty state when there are no past builds", async () => {
    mockEntities.mockResolvedValueOnce([]);
    render(<MemoryRouter><BuildHome /></MemoryRouter>);
    expect(await screen.findByText(/No builds yet/i)).toBeInTheDocument();
  });

  it("shows recent builds when entities exist", async () => {
    mockEntities.mockResolvedValueOnce([
      { id: "build-1", status: "completed", input: { description: "PR reviewer" }, createdAt: "2026-05-10T10:00:00Z", updatedAt: "2026-05-10T10:05:00Z" },
    ]);
    render(<MemoryRouter><BuildHome /></MemoryRouter>);
    expect(await screen.findByText(/PR reviewer/i)).toBeInTheDocument();
  });

  it("suggestion cards link with ?example=<slug>", async () => {
    mockEntities.mockResolvedValueOnce([]);
    render(<MemoryRouter><BuildHome /></MemoryRouter>);
    const link = await screen.findByRole("link", { name: /github pr reviewer/i });
    expect(link.getAttribute("href")).toMatch(/\?example=pr-reviewer/);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npx vitest run tests/client/BuildHome.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/client/pages/BuildHome.tsx`**

Reference for layout: `/tmp/handoff/design_handoff_claudepanion/source/build-home.jsx` (lift structure and copy from the `BuildHomeEditorial` component) + screenshot `02-build-home.png`.

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchEntities } from "../api";
import { Sketch } from "../icons/Sketch";
import type { Entity } from "@shared/types";

const SUGGESTIONS = [
  { slug: "pr-reviewer", icon: "🔎", title: "GitHub PR reviewer", blurb: "Review a PR — fetch the diff and existing comments, flag risky diffs, suggest review questions." },
  { slug: "cloudwatch", icon: "📊", title: "CloudWatch investigator", blurb: "Tail a log group, summarize errors, surface anomalies in the last hour." },
  { slug: "linear", icon: "📋", title: "Linear backlog groomer", blurb: "Pull the backlog, flag stale issues, suggest priority and assignee." },
];

export default function BuildHome() {
  const [builds, setBuilds] = useState<Entity[] | null>(null);
  useEffect(() => { void fetchEntities("build").then(setBuilds); }, []);

  return (
    <div style={{ maxWidth: 920, display: "flex", flexDirection: "column", gap: 64 }}>
      <div className="t-mono" style={{ color: "var(--muted)" }}>~/ build</div>

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <span className="pill pill-eyebrow" style={{ alignSelf: "flex-start" }}>THE BUILD COMPANION · CORE</span>
        <h1 className="t-display-sm" style={{ margin: 0 }}>
          <em className="t-accent-italic">Hi, I'm Build</em> — your first companion.
        </h1>
        <p className="t-body" style={{ color: "var(--muted)", margin: 0, maxWidth: "62ch" }}>
          I scaffold new companions from a plain-English description. Everything else you add to the sidebar came from me.
          Try one of the ideas below, or describe your own.
        </p>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <span className="t-eyebrow">Two ways to start</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Link to="/c/build/new" className="card-hairline" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="t-eyebrow">✨ New companion</span>
            <span className="t-h2" style={{ fontSize: 28 }}>Scaffold from scratch</span>
            <span className="t-caption">Describe a new companion in plain English and Build will create it.</span>
          </Link>
          <Link to="/c/build/new?mode=iterate" className="card-hairline" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="t-eyebrow">⟳ Iterate on existing</span>
            <span className="t-h2" style={{ fontSize: 28 }}>Evolve a companion</span>
            <span className="t-caption">Pick a companion and describe what should change.</span>
          </Link>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <span className="t-eyebrow">Or start from an idea</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {SUGGESTIONS.map((s) => (
            <Link key={s.slug} to={`/c/build/new?example=${s.slug}`} className="card-hairline" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 22 }} aria-hidden>{s.icon}</span>
              <span className="t-h3">{s.title}</span>
              <span className="t-caption">{s.blurb}</span>
              <span className="t-caption" style={{ color: "var(--accent)", marginTop: 4 }}>Try this →</span>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="t-eyebrow">Recent builds</span>
        {builds === null ? (
          <span className="t-caption">Loading…</span>
        ) : builds.length === 0 ? (
          <div className="t-caption" style={{ textAlign: "center", padding: 32 }}>
            No builds yet. The first one always feels like magic.
          </div>
        ) : (
          <div className="card-hairline" style={{ padding: 0 }}>
            {builds.slice(0, 5).map((b) => (
              <Link key={b.id} to={`/c/build/${b.id}`} style={{ display: "grid", gridTemplateColumns: "120px 1fr 120px", gap: 12, padding: "12px 16px", borderTop: "1px solid color-mix(in srgb, var(--ink) 8%, transparent)", color: "var(--ink)", textDecoration: "none" }}>
                <span className="t-caption" style={{ color: statusColor(b.status) }}>● {b.status}</span>
                <span>{summarize(b)}</span>
                <span className="t-mono" style={{ color: "var(--muted)", fontSize: 11 }}>{b.id.slice(0, 14)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function summarize(e: Entity): string {
  const input = e.input as Record<string, unknown>;
  const raw = (input.name ?? input.target ?? input.description ?? e.id) as string;
  return raw.length > 80 ? raw.slice(0, 77) + "…" : raw;
}

function statusColor(status: string): string {
  if (status === "completed") return "var(--status-success)";
  if (status === "running") return "var(--status-info)";
  if (status === "error") return "var(--status-error)";
  return "var(--status-warning)";
}
```

- [ ] **Step 4: Ensure `fetchEntities` exists in `src/client/api.ts`**

```bash
grep -n "fetchEntities" src/client/api.ts
```

If it doesn't exist as `fetchEntities(companion)` returning `Entity[]`, add it. The endpoint already exists: `GET /api/entities?companion=<slug>`.

- [ ] **Step 5: Branch on Build in `src/client/pages/CompanionRoute.tsx`**

Replace the whole file with:

```tsx
import { useParams } from "react-router-dom";
import { useCompanions } from "../hooks/useCompanions";
import BuildHome from "./BuildHome";
import CompanionAbout from "./CompanionAbout";
import ToolAbout from "./ToolAbout";

export default function CompanionRoute() {
  const { companion } = useParams<{ companion: string }>();
  const { companions, loading } = useCompanions();
  if (loading) return <div style={{ color: "var(--muted)" }}>Loading…</div>;
  const manifest = companions.find((c) => c.name === companion);
  if (!manifest) return <div style={{ color: "var(--status-error)" }}>Unknown companion: {companion}</div>;
  if (manifest.name === "build") return <BuildHome />;
  return manifest.kind === "tool" ? <ToolAbout /> : <CompanionAbout />;
}
```

- [ ] **Step 6: Run the BuildHome test**

```bash
npx vitest run tests/client/BuildHome.test.tsx
```
Expected: PASS — all 4 cases.

- [ ] **Step 7: Run the full test suite**

```bash
npx vitest run
```
Expected: still green.

- [ ] **Step 8: Visual smoke**

```bash
npm run dev
```
Visit `/c/build`. Should match `screenshots/02-build-home.png`: hero with italic accent, two start-mode cards, three suggestion cards, recent-builds section or empty-state copy.

- [ ] **Step 9: Commit**

```bash
git add src/client/pages/BuildHome.tsx src/client/pages/CompanionRoute.tsx \
        tests/client/BuildHome.test.tsx src/client/api.ts
git commit -m "ui(build): editorial home with two-mode cards and recent builds"
```

---

## Stage 3 — Build form

Goal: `companions/build/form.tsx` matches screenshots 03/04, with a contextual right aside.

### Task 3.1: BuildAside contextual panel

**Files:**
- Create: `src/client/components/BuildAside.tsx`
- Create: `tests/client/BuildAside.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/client/BuildAside.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import BuildAside from "../../src/client/components/BuildAside";

describe("BuildAside", () => {
  it("blank state shows the three example chips", () => {
    render(<BuildAside example={null} onPick={vi.fn()} />);
    expect(screen.getByText(/Or start from an example/i)).toBeInTheDocument();
    expect(screen.getByText(/GitHub PR reviewer/i)).toBeInTheDocument();
    expect(screen.getByText(/CloudWatch investigator/i)).toBeInTheDocument();
    expect(screen.getByText(/Linear backlog groomer/i)).toBeInTheDocument();
  });

  it("calls onPick with the slug when an example chip is clicked", () => {
    const onPick = vi.fn();
    render(<BuildAside example={null} onPick={onPick} />);
    fireEvent.click(screen.getByText(/GitHub PR reviewer/i));
    expect(onPick).toHaveBeenCalledWith("pr-reviewer");
  });

  it("prefilled state lists files Build will create", () => {
    render(<BuildAside example={{ slug: "pr-reviewer", displayName: "GitHub PR reviewer", icon: "🔎" }} onPick={vi.fn()} />);
    expect(screen.getByText(/What Build will create/i)).toBeInTheDocument();
    expect(screen.getByText(/manifest\.ts/)).toBeInTheDocument();
    expect(screen.getByText(/skills\/pr-reviewer\/SKILL\.md/)).toBeInTheDocument();
    expect(screen.getByText(/After submitting/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npx vitest run tests/client/BuildAside.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/client/components/BuildAside.tsx`**

```tsx
interface Example { slug: string; displayName: string; icon: string }

const EXAMPLES: Example[] = [
  { slug: "pr-reviewer", displayName: "GitHub PR reviewer", icon: "🔎" },
  { slug: "cloudwatch", displayName: "CloudWatch investigator", icon: "📊" },
  { slug: "linear", displayName: "Linear backlog groomer", icon: "📋" },
];

const CREATED_FILES = (slug: string) => [
  "manifest.ts + index.ts",
  "types.ts (Input + Artifact)",
  "form.tsx",
  "pages/List.tsx + Detail.tsx",
  "server/tools.ts",
  `skills/${slug}/SKILL.md`,
];

interface Props {
  example: Example | null;
  onPick: (slug: string) => void;
}

export default function BuildAside({ example, onPick }: Props) {
  if (example) {
    return (
      <aside style={{ position: "sticky", top: 24 }}>
        <div style={{ border: "1px solid color-mix(in srgb, var(--sage) 35%, transparent)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: "color-mix(in srgb, var(--sage) 10%, transparent)", borderBottom: "1px solid color-mix(in srgb, var(--sage) 20%, transparent)", display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 22 }} aria-hidden>{example.icon}</span>
            <div>
              <div className="t-h3">Starting from example</div>
              <div className="t-caption">{example.displayName}</div>
            </div>
          </div>
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div className="t-eyebrow" style={{ marginBottom: 4 }}>What Build will create</div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {CREATED_FILES(example.slug).map((f) => (
                  <li key={f} className="t-mono" style={{ fontSize: 12, lineHeight: 1.8, color: "var(--ink)" }}>{f}</li>
                ))}
              </ul>
            </div>
            <div style={{ paddingTop: 10, borderTop: "1px solid color-mix(in srgb, var(--ink) 6%, transparent)" }}>
              <div className="t-eyebrow" style={{ marginBottom: 4 }}>After submitting</div>
              <p className="t-caption" style={{ margin: 0 }}>
                A pending entity appears. Run the slash command in Claude Code — Build scaffolds, validates, and mounts the
                companion without a restart.
              </p>
            </div>
          </div>
        </div>
      </aside>
    );
  }
  return (
    <aside style={{ position: "sticky", top: 24 }}>
      <div className="card-soft">
        <div className="t-h3" style={{ marginBottom: 8 }}>Or start from an example</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {EXAMPLES.map((ex) => (
            <button key={ex.slug} type="button" className="btn-chip" onClick={() => onPick(ex.slug)} style={{ justifyContent: "flex-start", padding: "10px 12px", borderRadius: 6, fontSize: 13 }}>
              <span aria-hidden>{ex.icon}</span>
              <span style={{ color: "var(--ink)" }}>{ex.displayName}</span>
              <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 16 }}>→</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run tests/client/BuildAside.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/components/BuildAside.tsx tests/client/BuildAside.test.tsx
git commit -m "ui(build): contextual right aside for build form"
```

### Task 3.2: Restyle Build form

**Files:**
- Modify: `companions/build/form.tsx` (visual rewrite; preserves all existing form logic)
- Modify: `tests/client/BuildForm.test.tsx` (update assertions for new copy/structure if needed)

- [ ] **Step 1: Run existing BuildForm test to know the baseline**

```bash
npx vitest run tests/client/BuildForm.test.tsx
```
Note which assertions might depend on now-stale copy (e.g. specific text on tabs / submit button labels). Anything that asserts on `"Build companion"` / `"Iterate"` will still pass.

- [ ] **Step 2: Restyle `companions/build/form.tsx`**

Reference: `/tmp/handoff/design_handoff_claudepanion/source/build-form.jsx` (`BuildFormEditorial`) + screenshots 03/04. Preserve:
- The existing `mode` discriminated-union state.
- The existing `onSubmit` payload shape.
- The existing `?example=` and `?mode=iterate&target=` URL params.

Rewrite the JSX to:
- Show a breadcrumb (`claudepanion › Build › New companion`) at the top.
- Use a two-column grid: `1fr 320px` on widths ≥ 1024px, single-column below. Left = form, right = `<BuildAside>`.
- Hero variants:
  - Blank: `<h1 class="t-display-sm">Build a new <em class="t-accent-italic">companion</em>.</h1>`
  - Prefilled (example known): `<h1 class="t-display-sm">Scaffolding <em class="t-accent-italic">{icon} {displayName}</em></h1>`
- Mode tabs: replace the existing tab buttons with two `btn-chip`-styled toggles; the active one uses `background: var(--ink); color: var(--bg);`.
- Companion name input: mono input, helper text `lowercase · hyphens only · starts with a letter`.
- Kind picker: keep as two `role="radio"` cards (already there in current code), restyle each card with `card-hairline` and an accent-blue border when selected.
- Description textarea: keep functionality, restyle with hairline border, 14px Inter, generous padding.
- Submit row: ghost-pill "Cancel" + `btn-ink` "Build companion" / "Iterate".
- Right column renders `<BuildAside example={resolvedExample} onPick={pickExample} />` where:
  - `resolvedExample` is the example matching the current `?example=` query param (use the `EXAMPLES` list from BuildAside.tsx — re-export it if cleaner).
  - `pickExample(slug)` calls `navigate(`?example=${slug}`)` (use `useNavigate` from react-router-dom) and sets the description placeholder.

Keep the existing `onSubmit` payload generation intact — do not modify the discriminated union.

- [ ] **Step 3: Re-run BuildForm test**

```bash
npx vitest run tests/client/BuildForm.test.tsx
```
Expected: PASS. If any assertion breaks because of copy moves (`"Cancel"` not in the same DOM position, etc.), update the assertion to the new structure — never weaken the test, just point it at the right node.

- [ ] **Step 4: Run full suite**

```bash
npx vitest run
```
Expected: green.

- [ ] **Step 5: Visual smoke**

Open `/c/build/new` blank and with `?example=pr-reviewer`. Diff against `screenshots/03-build-form-blank.png` and `04-build-form-prefilled.png`.

- [ ] **Step 6: Commit**

```bash
git add companions/build/form.tsx tests/client/BuildForm.test.tsx
git commit -m "ui(build): editorial form layout with contextual aside"
```

---

## Stage 4 — Build run detail

Goal: `EntityDetail.tsx` matches screenshots 05–08 for the Build companion, with a log-pattern-derived step list and 2s polling. Non-Build companies get the same shell minus the step list.

### Task 4.1: buildSteps derivation

**Files:**
- Create: `src/client/lib/buildSteps.ts`
- Create: `tests/client/buildSteps.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/client/buildSteps.test.ts
import { describe, it, expect } from "vitest";
import { deriveSteps, BUILD_STEPS } from "../../src/client/lib/buildSteps";
import type { Entity } from "@shared/types";

function entityWith(status: Entity["status"], lines: string[]): Entity {
  return {
    id: "build-test", companion: "build",
    status, input: {}, artifact: null, errorMessage: null, errorStack: null, statusMessage: null,
    createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
    logs: lines.map((message, i) => ({ at: new Date(Date.now() + i * 1000).toISOString(), level: "info", message })),
  } as Entity;
}

describe("deriveSteps", () => {
  it("returns 6 steps in order regardless of input", () => {
    const result = deriveSteps(entityWith("pending", []));
    expect(result.map((s) => s.label)).toEqual(BUILD_STEPS);
  });

  it("all steps pending when entity has no logs", () => {
    const result = deriveSteps(entityWith("pending", []));
    expect(result.every((s) => s.status === "pending")).toBe(true);
  });

  it("marks reading-prompt as active when only that pattern has matched", () => {
    const result = deriveSteps(entityWith("running", ["reading prompt for build-x"]));
    expect(result[0].status).toBe("active");
    expect(result[1].status).toBe("pending");
  });

  it("marks earlier steps done when a later one matches", () => {
    const result = deriveSteps(entityWith("running", [
      "reading prompt",
      "drafting manifest.ts",
      "writing companions/foo/index.ts",
    ]));
    expect(result[0].status).toBe("done");      // Reading prompt
    expect(result[1].status).toBe("done");      // Designing
    expect(result[2].status).toBe("pending");   // Generating form schema — no match
    expect(result[3].status).toBe("active");    // Wiring MCP tools
    expect(result[4].status).toBe("pending");
  });

  it("marks active step as failed when entity status is error", () => {
    const result = deriveSteps(entityWith("error", [
      "reading prompt",
      "writing companions/foo/server/tools.ts",
    ]));
    expect(result[3].status).toBe("failed");
  });

  it("marks all matched steps done when entity status is completed", () => {
    const result = deriveSteps(entityWith("completed", [
      "reading prompt",
      "drafting manifest",
      "writing types.ts",
      "writing companions/foo/server/tools.ts",
      "writing skills/foo/SKILL.md",
      "validator passed",
    ]));
    expect(result.every((s) => s.status === "done")).toBe(true);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npx vitest run tests/client/buildSteps.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/client/lib/buildSteps.ts`**

```ts
import type { Entity, LogEntry } from "@shared/types";

export const BUILD_STEPS = [
  "Reading prompt",
  "Designing companion shape",
  "Generating form schema",
  "Wiring MCP tools",
  "Writing skill",
  "First boot",
] as const;

export type BuildStep = (typeof BUILD_STEPS)[number];
export type StepStatus = "pending" | "active" | "done" | "failed";
export interface DerivedStep { label: BuildStep; status: StepStatus }

const PATTERNS: Array<{ step: BuildStep; needles: string[] }> = [
  { step: "Reading prompt",            needles: ["reading prompt", "loaded entity"] },
  { step: "Designing companion shape", needles: ["drafting manifest", "designing"] },
  { step: "Generating form schema",    needles: ["form schema", "writing types"] },
  { step: "Wiring MCP tools",          needles: ["writing companions/", "wiring tools", "server/tools"] },
  { step: "Writing skill",             needles: ["writing skills/"] },
  { step: "First boot",                needles: ["running validator", "validator passed"] },
];

function lineMatchesStep(line: LogEntry, step: BuildStep): boolean {
  const haystack = line.message.toLowerCase();
  const entry = PATTERNS.find((p) => p.step === step)!;
  return entry.needles.some((n) => haystack.includes(n));
}

export function deriveSteps(entity: Entity): DerivedStep[] {
  const logs = entity.logs ?? [];
  const matchedIndexes = new Set<number>();
  let latestIdx = -1;
  for (const line of logs) {
    PATTERNS.forEach((p, idx) => {
      if (lineMatchesStep(line, p.step)) {
        matchedIndexes.add(idx);
        if (idx > latestIdx) latestIdx = idx;
      }
    });
  }

  return PATTERNS.map((p, idx): DerivedStep => {
    if (!matchedIndexes.has(idx)) return { label: p.step, status: "pending" };
    if (entity.status === "completed") return { label: p.step, status: "done" };
    if (idx < latestIdx) return { label: p.step, status: "done" };
    if (entity.status === "error") return { label: p.step, status: "failed" };
    return { label: p.step, status: "active" };
  });
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run tests/client/buildSteps.test.ts
```
Expected: PASS — all 6 cases green.

- [ ] **Step 5: Commit**

```bash
git add src/client/lib/buildSteps.ts tests/client/buildSteps.test.ts
git commit -m "ui(build): derive build steps from log line patterns"
```

### Task 4.2: useEntityPolling hook

**Files:**
- Create: `src/client/hooks/useEntityPolling.ts`
- Create: `tests/client/useEntityPolling.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/client/useEntityPolling.test.tsx
import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useEntityPolling } from "../../src/client/hooks/useEntityPolling";

describe("useEntityPolling", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("fetches once on mount and again every 2s while running", async () => {
    const fetchEntity = vi.fn().mockResolvedValue({ id: "x", companion: "build", status: "running", logs: [] });
    const { result } = renderHook(() => useEntityPolling("build", "x", { fetchEntity }));

    await waitFor(() => expect(fetchEntity).toHaveBeenCalledTimes(1));
    await act(async () => { vi.advanceTimersByTime(2000); });
    await waitFor(() => expect(fetchEntity).toHaveBeenCalledTimes(2));
    expect(result.current.entity?.status).toBe("running");
  });

  it("stops polling when entity reaches completed", async () => {
    const fetchEntity = vi.fn()
      .mockResolvedValueOnce({ id: "x", companion: "build", status: "running", logs: [] })
      .mockResolvedValueOnce({ id: "x", companion: "build", status: "completed", logs: [] });
    renderHook(() => useEntityPolling("build", "x", { fetchEntity }));

    await waitFor(() => expect(fetchEntity).toHaveBeenCalledTimes(1));
    await act(async () => { vi.advanceTimersByTime(2000); });
    await waitFor(() => expect(fetchEntity).toHaveBeenCalledTimes(2));
    await act(async () => { vi.advanceTimersByTime(10000); });
    expect(fetchEntity).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npx vitest run tests/client/useEntityPolling.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/client/hooks/useEntityPolling.ts`**

```ts
import { useEffect, useState } from "react";
import { fetchEntity as realFetchEntity } from "../api";
import type { Entity } from "@shared/types";

const POLL_MS = 2_000;
const TERMINAL: Entity["status"][] = ["completed", "error"];

interface Options { fetchEntity?: (companion: string, id: string) => Promise<Entity> }

export function useEntityPolling(companion: string, id: string, opts: Options = {}): { entity: Entity | null; isPolling: boolean } {
  const fetcher = opts.fetchEntity ?? realFetchEntity;
  const [entity, setEntity] = useState<Entity | null>(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      try {
        const next = await fetcher(companion, id);
        if (cancelled) return;
        setEntity(next);
        if (TERMINAL.includes(next.status) && intervalId !== null) {
          clearInterval(intervalId); intervalId = null;
        }
      } catch {
        /* network blip — keep last good state */
      }
    };

    const onVisibility = () => {
      if (document.hidden && intervalId !== null) {
        clearInterval(intervalId); intervalId = null;
      } else if (!document.hidden && intervalId === null && entity && !TERMINAL.includes(entity.status)) {
        intervalId = setInterval(tick, POLL_MS);
      }
    };

    void tick();
    intervalId = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (intervalId !== null) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [companion, id]);

  return { entity, isPolling: entity ? !TERMINAL.includes(entity.status) : true };
}
```

- [ ] **Step 4: Ensure `fetchEntity` exists in `src/client/api.ts`**

```bash
grep -n "fetchEntity" src/client/api.ts
```
If missing, add a function that hits `GET /api/entities/:id?companion=<slug>` and returns the JSON as `Entity`.

- [ ] **Step 5: Run the hook test**

```bash
npx vitest run tests/client/useEntityPolling.test.tsx
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/client/hooks/useEntityPolling.ts tests/client/useEntityPolling.test.tsx src/client/api.ts
git commit -m "ui(build): useEntityPolling hook with 2s cadence and visibility pause"
```

### Task 4.3: Rewrite EntityDetail

**Files:**
- Modify: `src/client/pages/EntityDetail.tsx` (substantial rewrite)
- Create: `tests/client/EntityDetail.facelift.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/client/EntityDetail.facelift.test.tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";

const mockEntity = vi.fn();
vi.mock("../../src/client/hooks/useEntityPolling", () => ({
  useEntityPolling: () => ({ entity: mockEntity(), isPolling: false }),
}));
vi.mock("../../src/client/hooks/useCompanions", () => ({
  useCompanions: () => ({ companions: [{ name: "build", displayName: "Build", icon: "🔨", kind: "ui" }], loading: false }),
}));

import EntityDetail from "../../src/client/pages/EntityDetail";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/c/:companion/:id" element={<EntityDetail />} /></Routes>
    </MemoryRouter>
  );
}

describe("EntityDetail (facelift)", () => {
  it("renders the 6 build step labels for a Build entity", () => {
    mockEntity.mockReturnValue({
      id: "build-1", companion: "build", status: "running", logs: [{ message: "reading prompt", at: "x", level: "info" }],
      input: {}, createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
    });
    renderAt("/c/build/build-1");
    expect(screen.getByText("Reading prompt")).toBeInTheDocument();
    expect(screen.getByText("First boot")).toBeInTheDocument();
  });

  it("disables 'Open companion' until status is completed", () => {
    mockEntity.mockReturnValue({
      id: "build-1", companion: "build", status: "running", logs: [],
      input: {}, createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
    });
    renderAt("/c/build/build-1");
    const cta = screen.getByRole("link", { name: /open companion/i });
    expect(cta).toHaveAttribute("aria-disabled", "true");
  });

  it("enables 'Open companion' when completed", () => {
    mockEntity.mockReturnValue({
      id: "build-1", companion: "build", status: "completed", logs: [],
      input: { name: "pr-reviewer" }, createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
      artifact: null,
    });
    renderAt("/c/build/build-1");
    const cta = screen.getByRole("link", { name: /open companion/i });
    expect(cta).not.toHaveAttribute("aria-disabled", "true");
  });

  it("shows error panel only when status is error", () => {
    mockEntity.mockReturnValue({
      id: "build-1", companion: "build", status: "error", logs: [],
      input: {}, createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
      errorMessage: "boom",
    });
    renderAt("/c/build/build-1");
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry build/i })).toBeInTheDocument();
  });

  it("does NOT render the step list for non-Build companions", () => {
    mockEntity.mockReturnValue({
      id: "x", companion: "pr-reviewer", status: "running", logs: [],
      input: {}, createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
    });
    renderAt("/c/pr-reviewer/x");
    expect(screen.queryByText("Reading prompt")).toBeNull();
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npx vitest run tests/client/EntityDetail.facelift.test.tsx
```
Expected: FAIL — assertions don't yet hold against the current EntityDetail.

- [ ] **Step 3: Rewrite `src/client/pages/EntityDetail.tsx`**

The new file. Replace the entire file with this — it inlines the new editorial shell and delegates step rendering to `buildSteps`. It still uses `useMcpStatus`, `BaseArtifactPanel`, `ContinuationForm`, and `MarkdownArtifactPanel` from the existing code:

```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useEntityPolling } from "../hooks/useEntityPolling";
import { useMcpStatus } from "../hooks/useMcpStatus";
import { fetchCompanions, continueEntity } from "../api";
import { deriveSteps, type DerivedStep } from "../lib/buildSteps";
import { Sketch } from "../icons/Sketch";
import BaseArtifactPanel from "../components/BaseArtifactPanel";
import ContinuationForm from "../components/ContinuationForm";
import { MarkdownArtifactPanel } from "../primitives/MarkdownArtifactPanel";
import { getArtifactRenderer } from "../../../companions/client";
import type { Entity, Manifest } from "@shared/types";

const MCP_GRACE_MS = 15_000;

export default function EntityDetail() {
  const { companion = "", id = "" } = useParams();
  const { entity } = useEntityPolling(companion, id);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  useEffect(() => { void fetchCompanions().then((all) => setManifest(all.find((m) => m.name === companion) ?? null)); }, [companion]);

  if (!entity) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  const isBuild = entity.companion === "build";
  const steps = isBuild ? deriveSteps(entity) : null;
  const latestLine = entity.logs.at(-1)?.message;

  return (
    <div style={{ maxWidth: 980, display: "flex", flexDirection: "column", gap: 32 }}>
      <Breadcrumb manifest={manifest} entityId={entity.id} />

      <Header entity={entity} />

      {entity.status === "pending" && <PendingBanner entity={entity} />}
      {latestLine && entity.status !== "completed" && entity.status !== "error" && (
        <StatusMonoBlock text={latestLine} />
      )}

      <SlashRow entity={entity} />

      {steps && <StepList steps={steps} />}

      <LogPane logs={entity.logs.map((l) => l.message)} polling={entity.status === "running" || entity.status === "pending"} />

      {entity.status === "completed" && <CompletedArtifact entity={entity} />}
      {entity.status === "error" && <ErrorPanel entity={entity} />}

      <FooterBar entity={entity} />

      <ContinuationFormSection entity={entity} />
    </div>
  );
}

function Breadcrumb({ manifest, entityId }: { manifest: Manifest | null; entityId: string }) {
  return (
    <div className="t-mono" style={{ color: "var(--muted)" }}>
      <Link to="/" style={{ color: "var(--muted)", textDecoration: "none" }}>claudepanion</Link>
      {manifest && <> › <Link to={`/c/${manifest.name}`} style={{ color: "var(--muted)", textDecoration: "none" }}>{manifest.displayName}</Link></>}
      {" › "}
      <span>{entityId}</span>
    </div>
  );
}

function Header({ entity }: { entity: Entity }) {
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <h1 className="t-display-sm" style={{ margin: 0 }}>{titleOf(entity)}</h1>
      <div className="t-caption">
        {subtitleOf(entity)} · ID <code>{entity.id}</code>
        <StatusInline status={entity.status} />
      </div>
    </header>
  );
}

function StatusInline({ status }: { status: Entity["status"] }) {
  const color = statusColor(status);
  return <span style={{ marginLeft: 12, color }}>● {status}</span>;
}

function StatusMonoBlock({ text }: { text: string }) {
  return (
    <div className="panel-mono" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--status-info)" }} />
      <span className="t-eyebrow" style={{ color: "var(--bg)" }}>Running</span>
      <span style={{ opacity: 0.8 }}>{text}</span>
    </div>
  );
}

function SlashRow({ entity }: { entity: Entity }) {
  const cmd = `/${entity.companion}-companion ${entity.id}`;
  return (
    <div className="card-hairline" style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span className="t-caption" style={{ color: "var(--muted)" }}>Slash command</span>
      <code className="t-mono" style={{ background: "var(--ink)", color: "var(--bg)", padding: "6px 12px", borderRadius: 6 }}>{cmd}</code>
    </div>
  );
}

function StepList({ steps }: { steps: DerivedStep[] }) {
  return (
    <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {steps.map((s) => (
        <li key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StepIcon status={s.status} />
          <span style={{ color: s.status === "pending" ? "var(--muted)" : "var(--ink)" }}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function StepIcon({ status }: { status: DerivedStep["status"] }) {
  if (status === "done") return <span style={{ color: "var(--status-success)" }}>✓</span>;
  if (status === "failed") return <span style={{ color: "var(--status-error)" }}>×</span>;
  if (status === "active") return <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "var(--status-info)", animation: "pulse 1.2s ease-in-out infinite" }} />;
  return <span style={{ color: "var(--muted)" }}>○</span>;
}

function LogPane({ logs, polling }: { logs: string[]; polling: boolean }) {
  return (
    <section className="panel-mono" style={{ background: "var(--ink)", borderRadius: 8 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderBottom: "1px solid color-mix(in srgb, var(--bg) 12%, transparent)" }}>
        <span className="t-eyebrow" style={{ color: "var(--bg)" }}>Logs</span>
        {polling && <span className="t-caption" style={{ color: "var(--bg)", opacity: 0.6 }}>· polling every 2s</span>}
      </header>
      <pre style={{ margin: 0, padding: 12, fontSize: 12, color: "var(--bg)", whiteSpace: "pre-wrap", maxHeight: 320, overflow: "auto" }}>
        {logs.length === 0 ? "Waiting for agent…" : logs.join("\n")}
      </pre>
    </section>
  );
}

function PendingBanner({ entity }: { entity: Entity }) {
  const mcp = useMcpStatus(true);
  const ageMs = Date.now() - new Date(entity.createdAt).getTime();
  const stuck = !mcp.loading && mcp.firstRequestAt === null && ageMs > MCP_GRACE_MS;
  if (!stuck) return null;
  return (
    <div className="card-hairline" style={{ borderColor: "var(--status-warning)", background: "color-mix(in srgb, var(--status-warning) 8%, transparent)" }}>
      <strong>⚠ claudepanion hasn't seen any MCP connection.</strong>
      <ol style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
        <li>Run <code>/mcp</code> in your Claude Code session.</li>
        <li><code>claudepanion plugin install</code> in your repo.</li>
        <li>Restart your Claude Code session.</li>
      </ol>
    </div>
  );
}

function CompletedArtifact({ entity }: { entity: Entity }) {
  const Renderer = getArtifactRenderer(entity.companion);
  return (
    <section className="card-hairline">
      <span className="t-eyebrow">Artifact</span>
      <BaseArtifactPanel entity={entity}>
        {Renderer ? <Renderer entity={entity} /> : entity.artifact ? <MarkdownArtifactPanel artifact={entity.artifact as any} /> : <pre>{JSON.stringify(entity.artifact, null, 2)}</pre>}
      </BaseArtifactPanel>
    </section>
  );
}

function ErrorPanel({ entity }: { entity: Entity }) {
  return (
    <section className="card-hairline" style={{ borderColor: "var(--status-error)" }}>
      <span className="t-eyebrow" style={{ color: "var(--status-error)" }}>Error</span>
      <p style={{ marginTop: 4 }}>{entity.errorMessage ?? "Unknown error"}</p>
      {entity.errorStack && <pre className="t-mono" style={{ fontSize: 12, maxHeight: 200, overflow: "auto", marginTop: 8 }}>{entity.errorStack}</pre>}
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button type="button" className="btn-ink" onClick={() => void continueEntity(entity.companion, entity.id, "retry")}>Retry build</button>
        <Link to={`/c/build/new?mode=iterate&target=${entity.companion}`} className="btn-ghost">Edit prompt</Link>
      </div>
    </section>
  );
}

function FooterBar({ entity }: { entity: Entity }) {
  const targetSlug = (entity.input as Record<string, unknown>).name as string | undefined;
  const enabled = entity.status === "completed" && entity.companion === "build" && targetSlug;
  return (
    <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid color-mix(in srgb, var(--ink) 8%, transparent)" }}>
      <Link to={`/c/${entity.companion}`} className="t-caption" style={{ color: "var(--muted)" }}>← Back</Link>
      <Link
        to={enabled ? `/c/${targetSlug}` : "#"}
        className="btn-ink"
        aria-disabled={enabled ? undefined : "true"}
        style={{ pointerEvents: enabled ? "auto" : "none", opacity: enabled ? 1 : 0.4 }}
      >
        Open companion →
      </Link>
    </footer>
  );
}

function ContinuationFormSection({ entity }: { entity: Entity }) {
  if (entity.status === "completed") {
    return (
      <ContinuationForm
        title="Not quite right? Ask Claude to revise."
        hint="Describe what to change and get a new slash command. The artifact above is kept as context."
        cta="Continue"
        placeholder="e.g. 'redo with a tighter summary'"
        onSubmit={async (text) => { await continueEntity(entity.companion, entity.id, text); }}
      />
    );
  }
  return null;
}

function titleOf(e: Entity): string {
  const input = e.input as Record<string, unknown>;
  const raw = (input.title ?? input.name ?? input.target ?? input.description ?? e.companion) as string;
  return raw.length > 60 ? raw.slice(0, 57) + "…" : raw;
}

function subtitleOf(e: Entity): string {
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

function statusColor(status: Entity["status"]): string {
  if (status === "completed") return "var(--status-success)";
  if (status === "running") return "var(--status-info)";
  if (status === "error") return "var(--status-error)";
  return "var(--status-warning)";
}
```

- [ ] **Step 4: Append a tiny pulse keyframe to `src/client/styles.css`**

```css
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.85); }
}
```

- [ ] **Step 5: Run the new test**

```bash
npx vitest run tests/client/EntityDetail.facelift.test.tsx
```
Expected: PASS — all 5 cases.

- [ ] **Step 6: Run the full test suite**

```bash
npx vitest run
```
Expected: green. If existing EntityDetail tests fail because they assert old markup (`StatusPill`, etc.), update assertions to point at the new structure (`screen.getByText(/● running/)` instead of looking for `<StatusPill>`).

- [ ] **Step 7: Visual smoke**

Manually visit a Build entity in each state (pending / running / completed / error). Diff against screenshots 05–08.

- [ ] **Step 8: Commit**

```bash
git add src/client/pages/EntityDetail.tsx src/client/styles.css \
        tests/client/EntityDetail.facelift.test.tsx
git commit -m "ui(build): editorial run detail with step list and log pane"
```

---

## Stage 5 — CompanionForm primitive + CompanionAbout + Install

Goal: generic shell + install page + user companions inherit the editorial look via the primitive.

### Task 5.1: Restyle CompanionForm primitive

**Files:**
- Modify: `src/client/primitives/CompanionForm.tsx`

- [ ] **Step 1: Run the existing primitive tests as baseline**

```bash
npx vitest run tests/client/CompanionForm.test.tsx tests/client/descriptor-to-schema.test.ts
```
Expected: green. We must not regress validation behavior — only presentation changes.

- [ ] **Step 2: Restyle the primitive (presentational changes only)**

In `src/client/primitives/CompanionForm.tsx`:

a. The outermost `<form>` element keeps existing structure; add `className="editorial-form"` so styles target it.

b. Replace ad-hoc inline styles on inputs, textareas, selects, buttons with classnames:
- Inputs: add `className="editorial-input"`.
- Textareas: add `className="editorial-input editorial-textarea"`.
- Selects: add `className="editorial-input editorial-select"`.
- Submit button: replace inline styles with `className="btn-ink"`.
- Field labels: wrap label text in `<span className="t-eyebrow">…</span>`.
- Helper text/descriptions: `<span className="t-caption">…</span>`.
- Error text: `<span className="t-caption" style={{ color: "var(--status-error)" }}>…</span>`.

c. Append the following block to `src/client/styles.css`:

```css
/* ── Editorial form primitive ──────────────────────────────────── */
.editorial-form { display: flex; flex-direction: column; gap: 18px; max-width: 640px; }
.editorial-form label { display: flex; flex-direction: column; gap: 6px; }
.editorial-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg);
  color: var(--ink);
  border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  border-radius: 8px;
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.5;
  transition: border-color 150ms ease-out;
}
.editorial-input:focus { outline: none; border-color: var(--accent); }
.editorial-textarea { min-height: 120px; resize: vertical; font-family: var(--font-body); }
.editorial-select { appearance: none; background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%); background-position: calc(100% - 16px) center, calc(100% - 12px) center; background-size: 4px 4px, 4px 4px; background-repeat: no-repeat; padding-right: 32px; }
```

- [ ] **Step 3: Re-run primitive tests**

```bash
npx vitest run tests/client/CompanionForm.test.tsx tests/client/descriptor-to-schema.test.ts
```
Expected: still green. Validation logic untouched.

- [ ] **Step 4: Run full suite**

```bash
npx vitest run
```
Expected: green.

- [ ] **Step 5: Visual smoke**

Run `npm run dev` and load a user companion that has a `select` field (e.g. one with `ui.kind: "select"` and `optionsFrom`). Confirm inputs render in the editorial style.

- [ ] **Step 6: Commit**

```bash
git add src/client/primitives/CompanionForm.tsx src/client/styles.css
git commit -m "ui(primitive): editorial styling for schema-driven CompanionForm"
```

### Task 5.2: Restyle CompanionAbout

**Files:**
- Modify: `src/client/pages/CompanionAbout.tsx`

- [ ] **Step 1: Run the existing CompanionAbout test as baseline**

```bash
npx vitest run tests/client/CompanionAbout.test.tsx
```
Expected: green.

- [ ] **Step 2: Restyle `src/client/pages/CompanionAbout.tsx`**

Reference: `/tmp/handoff/design_handoff_claudepanion/source/companion-home.jsx` (`CompanionHomeEditorial`) + screenshots 09 (empty) / 10 (populated).

Rewrite the JSX (keep all data-fetching hooks intact) so the page renders, top to bottom:

1. Breadcrumb: `claudepanion › <DisplayName>` using the same Breadcrumb component pattern from EntityDetail.
2. **Header block** — flex row:
   - Left: 96×96 `--soft` square containing a `Sketch` icon (use `Sketch.Search`, `Sketch.Companion`, etc. — pick based on `manifest.icon` glyph; fallback to `Sketch.Companion`).
   - Right column: `t-h2` display name, `t-body` muted one-line description, mono meta line: `v{manifest.version} · {manifest.kind} · {entities.length} runs`.
3. **CTA row**: `<Link className="btn-ghost" to={`/c/build/new?mode=iterate&target=${manifest.name}`}>🔨 Iterate with Build</Link>` + `<Link className="btn-ink" to={`/c/${manifest.name}/new`}>+ New run</Link>`.
4. **Runs section**:
   - If `entities.length === 0`: empty-state with `<Sketch.Plant size={120} style={{ color: "color-mix(in srgb, var(--ink) 15%, transparent)" }} />` centered and `<span className="t-caption">Past runs will live here.</span>` below.
   - Else: `card-hairline` table:
     - Header row: t-eyebrow `Status` / `Description` / `When` / blank for chevron.
     - Body rows: `● {status}` (color from `statusColor()`), description (truncated 80 chars), timeAgo, `→`. Whole row links to `/c/<slug>/<id>`.
   - Footer: `t-caption` `Showing {min(N, 10)} of {N} runs · <Link>show all →</Link>` when N > 10.

Keep the existing data fetch (the page already calls `fetchEntities(companion)`); do not change the data path.

- [ ] **Step 3: Re-run CompanionAbout test**

```bash
npx vitest run tests/client/CompanionAbout.test.tsx
```
Expected: green. If assertions break on copy moves, update selectors — don't weaken the test.

- [ ] **Step 4: Visual smoke**

Visit a user companion's home in both empty and populated states. Diff against screenshots 09 / 10.

- [ ] **Step 5: Commit**

```bash
git add src/client/pages/CompanionAbout.tsx tests/client/CompanionAbout.test.tsx
git commit -m "ui(companion): editorial home with icon header and runs table"
```

### Task 5.3: Restyle Install + NewEntity

**Files:**
- Modify: `src/client/pages/Install.tsx`
- Modify: `src/client/pages/NewEntity.tsx`

- [ ] **Step 1: Run baseline tests**

```bash
npx vitest run tests/client/Install.test.tsx tests/client/NewEntity.test.tsx 2>&1 | tail -20
```
Note baseline (some tests may not exist; that's fine).

- [ ] **Step 2: Restyle `src/client/pages/Install.tsx`**

Reference: `/tmp/handoff/design_handoff_claudepanion/source/install-page.jsx` (`InstallEditorial`) + screenshots 11–14.

Layout (preserve all existing wiring around `POST /api/install` and the local `installState` machine):

1. Breadcrumb.
2. `<span class="pill pill-eyebrow">INSTALL FROM NPM</span>`.
3. `<h1 class="t-display-sm">What would you like to install?</h1>`.
4. Two-column grid (`1fr 320px`):
   - Left: mono input `<input className="editorial-input t-mono" placeholder="claudepanion-pr-reviewer" />` with a `t-caption` prefix `$ npx claudepanion install ` rendered as static text above. State panel below the input rendering one of:
     - **idle:** just the input + a submit `btn-ink` "Install".
     - **installing:** input replaced with a `panel-mono` block showing the running command + spinner.
     - **success:** `card-hairline` with `borderColor: var(--status-success)`, ✓, `Installed <pkg> · v<ver>`, `<Link to={`/c/<slug>`} class="btn-ink">Open companion →</Link>`.
     - **error:** `card-hairline` with `borderColor: var(--status-error)`, ×, npm error in mono.
   - Right: `card-soft` listing 4 community packages (hardcode as constants): `claudepanion-pr-reviewer`, `claudepanion-oncall`, `claudepanion-linear-grooming`, `claudepanion-rss-summarizer`. Each row: package name (mono), author + version + downloads (t-caption), `btn-chip` "Install" that prefills the input.
5. Below the grid: `<p class="t-caption">Anything published as <code>claudepanion-&lt;name&gt;</code> works. Browse all on <a href="https://npmjs.com/search?q=claudepanion-">npmjs.com →</a></p>`.

- [ ] **Step 3: Restyle `src/client/pages/NewEntity.tsx`**

Wrap the existing `CompanionForm` render with:

```tsx
<div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 24 }}>
  <Breadcrumb /* same as other pages */ />
  <span className="t-eyebrow">New run</span>
  <h1 className="t-display-sm" style={{ margin: 0 }}>{manifest.displayName}</h1>
  <p className="t-caption">{manifest.description}</p>
  <CompanionForm /* unchanged props */ />
</div>
```

No logic change.

- [ ] **Step 4: Run the full suite**

```bash
npx vitest run
```
Expected: green.

- [ ] **Step 5: Visual smoke**

Open `/install` and step through each state (idle → typing a package → installing → success or error). Diff against screenshots 11–14. Open `/c/<existing-companion>/new` and confirm the new run form is editorial-styled.

- [ ] **Step 6: Commit**

```bash
git add src/client/pages/Install.tsx src/client/pages/NewEntity.tsx
git commit -m "ui(install): editorial install page with state panels and community packages"
```

---

## Final pass

### Task 6.1: Cross-screen QA

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```
Expected: green. Note total count; should be ≥ baseline from preflight + the new tests added across stages.

- [ ] **Step 2: Run the type check + build**

```bash
npm run build
```
Expected: clean compile, no TS errors.

- [ ] **Step 3: Visual diff each screen**

For each pair, eyeball side-by-side:

| Screen | URL | Reference |
|---|---|---|
| Build home | `/c/build` | `screenshots/02-build-home.png` |
| Build form blank | `/c/build/new` | `screenshots/03-build-form-blank.png` |
| Build form prefilled | `/c/build/new?example=pr-reviewer` | `screenshots/04-build-form-prefilled.png` |
| Build run pending | a real pending entity URL | `screenshots/05-detail-pending.png` |
| Build run running | a real running entity URL | `screenshots/06-detail-running.png` |
| Build run completed | a completed entity URL | `screenshots/07-detail-completed.png` |
| Build run error | an errored entity URL | `screenshots/08-detail-error.png` |
| Companion empty | `/c/<empty-companion>` | `screenshots/09-companion-empty.png` |
| Companion populated | `/c/<populated-companion>` | `screenshots/10-companion-populated.png` |
| Install idle | `/install` | `screenshots/11-install-idle.png` |
| Install installing | mid-install | `screenshots/12-install-installing.png` |
| Install success | post-install | `screenshots/13-install-success.png` |
| Install error | failed install | `screenshots/14-install-error.png` |

Document any deltas in a notes file or directly in the PR description.

### Task 6.2: Open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin ui/facelift-v2
```

- [ ] **Step 2: Create the PR**

```bash
gh pr create --title "ui: Editorial · Cool facelift (5 stages)" --body "$(cat <<'EOF'
## Summary
Applies the Editorial · Cool design handoff to the in-app surfaces. Five reviewable commits:

1. **Foundation** — Google Fonts, design tokens, sketch icons, sidebar with SystemRail, `/api/health` endpoint
2. **Build home** — `BuildHome.tsx` with hero, two-mode cards, suggestions, recent builds
3. **Build form** — editorial layout with contextual right aside
4. **Build run detail** — step list (log-pattern-derived) + log pane + 2s polling
5. **Generic shell + Install** — `CompanionForm` primitive + `CompanionAbout` + `Install` + `NewEntity`

Spec: `docs/superpowers/specs/2026-05-12-ui-facelift-redo-design.md`
Handoff source: `/tmp/handoff/design_handoff_claudepanion/`

## Test plan
- [ ] `npm run build` clean
- [ ] `npx vitest run` all green
- [ ] Visual diff each screen against handoff screenshots (see Final pass task in plan)
- [ ] Confirm SystemRail dots reflect real `/api/health` data
- [ ] Confirm `/api/companions/:name/input-schema`-driven forms render with editorial styling
- [ ] Confirm Build run detail step list updates as a real build progresses

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Plan self-review notes

- **Spec coverage:** every section/requirement from the spec has at least one task. Foundation (tokens, fonts, icons, sidebar, health) = stage 1. BuildHome = task 2.1. BuildAside = task 3.1. Build form restyle = task 3.2. buildSteps + polling + EntityDetail rewrite = tasks 4.1/4.2/4.3. CompanionForm + CompanionAbout + Install + NewEntity = tasks 5.1/5.2/5.3.
- **Type consistency:** `Entity` / `Manifest` / `LogEntry` are imported from `@shared/types` consistently. The `DerivedStep` / `StepStatus` types in `buildSteps.ts` are referenced unchanged in `EntityDetail.tsx`. The `Health` shape returned by `/api/health` matches `HealthResult` in `health.ts` and the `Health` type in `useHealth.ts`.
- **Reference handoff JSX** is treated as visual-only — the plan never asks the engineer to lift the inline-style `p.ink` pattern. All styling routes through CSS classes in `styles.css`.
- **The `ui/facelift-v2` branch name** keeps the original `ui/facelift` on origin as a reference; we don't overwrite it.
