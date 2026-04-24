# Grounding Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Grounding companion — an entity companion that reads claudepanion's architecture docs and produces a narrative orientation briefing.

**Architecture:** Standard entity companion following the established pattern in `companions/build/` and `companions/expense-tracker/` (now removed but its templates remain). New dependency: `react-markdown` for rendering the briefing markdown. Skill reads three fixed files (`grounding.md`, `reference-architecture.md`, `docs/concept.md`) and writes a four-part narrative artifact.

**Tech Stack:** React 18, TypeScript, react-markdown, vitest + @testing-library/react. No new server changes — generic MCP tools auto-register.

**Spec:** [`docs/superpowers/specs/2026-04-24-grounding-companion-design.md`](../specs/2026-04-24-grounding-companion-design.md)

---

## File structure

| Path | Responsibility |
|---|---|
| `companions/grounding/manifest.ts` | slug, kind, icon, description |
| `companions/grounding/types.ts` | `GroundingInput`, `GroundingArtifact` |
| `companions/grounding/index.ts` | re-exports manifest + tools |
| `companions/grounding/form.tsx` | single optional textarea, "Focus area" label |
| `companions/grounding/pages/List.tsx` | row: focus text or "Full overview" + created-at |
| `companions/grounding/pages/Detail.tsx` | renders `artifact.briefing` via react-markdown |
| `companions/grounding/server/tools.ts` | empty — no domain tools |
| `skills/grounding-companion/SKILL.md` | Claude's playbook for the slash command |
| `companions/index.ts` | add grounding import + array entry |
| `companions/client.ts` | register GroundingDetail / GroundingListRow / GroundingForm |
| `package.json` | add `react-markdown` |
| `tests/client/grounding.test.tsx` | render tests for form + list row + detail |

---

## Task 1: Install react-markdown + companion files

**Files:**
- Modify: `package.json`
- Create: `companions/grounding/manifest.ts`
- Create: `companions/grounding/types.ts`
- Create: `companions/grounding/server/tools.ts`
- Create: `companions/grounding/index.ts`

- [ ] **Step 1.1: Install react-markdown**

```bash
npm install react-markdown
```

Expected: no errors, `react-markdown` appears in `package.json` dependencies.

- [ ] **Step 1.2: Create manifest**

`companions/grounding/manifest.ts`:

```ts
import type { Manifest } from "../../src/shared/types.js";

export const manifest: Manifest = {
  name: "grounding",
  kind: "entity",
  displayName: "Grounding",
  icon: "🧭",
  description: "Reads the claudepanion architecture docs and produces a narrative orientation briefing.",
  contractVersion: "1",
  version: "0.1.0",
};
```

- [ ] **Step 1.3: Create types**

`companions/grounding/types.ts`:

```ts
export interface GroundingInput {
  /** Optional focus area — e.g. "plugin system", "MCP wiring". Omit for full overview. */
  focus?: string;
}

export interface GroundingArtifact {
  briefing: string;  // Markdown narrative — four sections.
}
```

- [ ] **Step 1.4: Create server/tools (empty)**

`companions/grounding/server/tools.ts`:

```ts
import type { ToolHandler } from "../../../src/server/companion-registry.js";

export const tools: Record<string, ToolHandler> = {};
```

- [ ] **Step 1.5: Create index**

`companions/grounding/index.ts`:

```ts
import type { RegisteredCompanion } from "../../src/server/companion-registry.js";
import { manifest } from "./manifest.js";
import { tools } from "./server/tools.js";

export const grounding: RegisteredCompanion = { manifest, tools };
```

- [ ] **Step 1.6: Typecheck**

```bash
npm run check
```

Expected: clean (no errors).

- [ ] **Step 1.7: Commit**

```bash
git add companions/grounding package.json package-lock.json
git commit -m "grounding: companion scaffolding + react-markdown dep"
```

---

## Task 2: Form, List row, Detail page

**Files:**
- Create: `companions/grounding/form.tsx`
- Create: `companions/grounding/pages/List.tsx`
- Create: `companions/grounding/pages/Detail.tsx`
- Create: `tests/client/grounding.test.tsx`

- [ ] **Step 2.1: Write the failing tests**

`tests/client/grounding.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GroundingForm from "../../companions/grounding/form";
import GroundingListRow from "../../companions/grounding/pages/List";
import GroundingDetail from "../../companions/grounding/pages/Detail";
import type { Entity } from "../../src/shared/types";
import type { GroundingInput, GroundingArtifact } from "../../companions/grounding/types";

function mkEntity(input: GroundingInput, artifact?: GroundingArtifact): Entity<GroundingInput, GroundingArtifact> {
  return {
    id: "grounding-abc",
    companion: "grounding",
    status: artifact ? "completed" : "pending",
    statusMessage: null,
    createdAt: "2026-04-24T00:00:00Z",
    updatedAt: "2026-04-24T00:00:00Z",
    input,
    artifact: artifact ?? null,
    errorMessage: null,
    errorStack: null,
    logs: [],
  };
}

describe("GroundingForm", () => {
  it("renders the focus area textarea with correct placeholder", () => {
    render(<MemoryRouter><GroundingForm onSubmit={() => {}} /></MemoryRouter>);
    const ta = screen.getByRole("textbox");
    expect(ta).toBeInTheDocument();
    expect(ta).toHaveAttribute("placeholder", expect.stringContaining("plugin system"));
  });

  it("submits with focus undefined when textarea is empty", async () => {
    let submitted: GroundingInput | null = null;
    render(<MemoryRouter><GroundingForm onSubmit={(i) => { submitted = i; }} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /run/i }));
    await new Promise((r) => setTimeout(r, 10));
    expect(submitted).not.toBeNull();
    expect((submitted as GroundingInput).focus).toBeUndefined();
  });
});

describe("GroundingListRow", () => {
  it("shows 'Full overview' when focus is empty", () => {
    render(<GroundingListRow entity={mkEntity({})} />);
    expect(screen.getByText("Full overview")).toBeInTheDocument();
  });

  it("shows focus text when focus is set", () => {
    render(<GroundingListRow entity={mkEntity({ focus: "plugin system" })} />);
    expect(screen.getByText("plugin system")).toBeInTheDocument();
  });
});

describe("GroundingDetail", () => {
  it("renders null when no artifact", () => {
    const { container } = render(<GroundingDetail entity={mkEntity({})} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the briefing markdown", () => {
    render(<GroundingDetail entity={mkEntity({}, { briefing: "## Thesis\n\nClaudepanion is..." })} />);
    expect(screen.getByRole("heading", { name: "Thesis" })).toBeInTheDocument();
    expect(screen.getByText(/Claudepanion is/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2.2: Run tests to verify they fail**

```bash
npx vitest run tests/client/grounding.test.tsx
```

Expected: FAIL — modules don't exist yet.

- [ ] **Step 2.3: Create form**

`companions/grounding/form.tsx`:

```tsx
import { useState } from "react";
import type { GroundingInput } from "./types";

interface Props {
  onSubmit: (input: GroundingInput) => void | Promise<void>;
}

export default function GroundingForm({ onSubmit }: Props) {
  const [focus, setFocus] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = focus.trim();
    void onSubmit(trimmed ? { focus: trimmed } : {});
  };
  return (
    <form onSubmit={submit} style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
        Focus area <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span>
        <textarea
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          rows={3}
          placeholder='e.g. "plugin system" or "companion contract" — leave blank for a full overview'
          style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6, resize: "vertical" as const }}
        />
      </label>
      <button className="btn" type="submit" style={{ alignSelf: "flex-start" }}>Run</button>
    </form>
  );
}
```

- [ ] **Step 2.4: Create List row**

`companions/grounding/pages/List.tsx`:

```tsx
import type { Entity } from "../../../src/shared/types";
import type { GroundingInput, GroundingArtifact } from "../types";

export default function GroundingListRow({ entity }: { entity: Entity<GroundingInput, GroundingArtifact> }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
      <span style={{ fontWeight: 500 }}>
        {entity.input.focus?.trim() || "Full overview"}
      </span>
    </div>
  );
}
```

- [ ] **Step 2.5: Create Detail page**

`companions/grounding/pages/Detail.tsx`:

```tsx
import ReactMarkdown from "react-markdown";
import type { Entity } from "../../../src/shared/types";
import type { GroundingInput, GroundingArtifact } from "../types";

export default function GroundingDetail({ entity }: { entity: Entity<GroundingInput, GroundingArtifact> }) {
  if (!entity.artifact) return null;
  return (
    <div style={{ fontSize: 14, lineHeight: 1.6 }}>
      <ReactMarkdown>{entity.artifact.briefing}</ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2.6: Run tests to verify they pass**

```bash
npx vitest run tests/client/grounding.test.tsx
```

Expected: all tests pass.

- [ ] **Step 2.7: Commit**

```bash
git add companions/grounding/form.tsx companions/grounding/pages tests/client/grounding.test.tsx
git commit -m "grounding: form + list row + detail with react-markdown"
```

---

## Task 3: Register companion + wire into host

**Files:**
- Modify: `companions/index.ts`
- Modify: `companions/client.ts`

- [ ] **Step 3.1: Add to companions/index.ts**

Read the current file first. Add the grounding import and entry in alphabetical slug order (grounding comes before nothing else currently, after build):

```ts
import type { RegisteredCompanion } from "../src/server/companion-registry.js";
import { build } from "./build/index.js";
import { grounding } from "./grounding/index.js";

export const companions: RegisteredCompanion[] = [build, grounding];
```

- [ ] **Step 3.2: Add to companions/client.ts**

Read the current file. Add three imports and three registry entries:

```ts
import GroundingDetail from "./grounding/pages/Detail";
import GroundingListRow from "./grounding/pages/List";
import GroundingForm from "./grounding/form";
```

```ts
// in artifactRenderers:
  "grounding": GroundingDetail as ArtifactRenderer,
// in listRows:
  "grounding": GroundingListRow as ListRow,
// in forms:
  "grounding": GroundingForm as CompanionForm,
```

- [ ] **Step 3.3: Typecheck + full test suite**

```bash
npm run check && npm test
```

Expected: typecheck clean, all tests pass (should be 107 — 102 prior + 5 new).

- [ ] **Step 3.4: Commit**

```bash
git add companions/index.ts companions/client.ts
git commit -m "grounding: register in host index + client"
```

---

## Task 4: Skill playbook

**Files:**
- Create: `skills/grounding-companion/SKILL.md`

- [ ] **Step 4.1: Create the nested skill directory and SKILL.md**

```bash
mkdir -p skills/grounding-companion
```

`skills/grounding-companion/SKILL.md`:

````markdown
---
name: grounding-companion
description: Use when the user pastes "/grounding-companion <entity-id>" — reads the claudepanion architecture docs and produces a narrative orientation briefing.
---

# /grounding-companion <entity-id>

Produce a narrative architecture briefing for a claudepanion session.

> **CRITICAL — MCP tools ONLY:**
> - All state changes go through `mcp__claudepanion__grounding_*` tools.
> - NEVER curl `/api/entities/*`. NEVER edit `data/grounding/*.json`.
> - On any MCP error: `mcp__claudepanion__grounding_fail` and stop.

## Step 1 — Load entity

```
mcp__claudepanion__grounding_get({ id: "<entity-id>" })
```

Note `entity.input.focus` — may be undefined (full overview) or a string like `"plugin system"`.

## Step 2 — Mark running

```
mcp__claudepanion__grounding_update_status({ id: "<entity-id>", status: "running", statusMessage: "reading docs" })
```

## Step 3 — Read the three architecture docs

Read all three files in full:

1. `grounding.md` — meta-reference: the thesis, companion model, end-to-end flow, key rules not to repeat.
2. `reference-architecture.md` — technical reference: plugin wiring, MCP session lifecycle, tool registration, data layer, REST surface, skills convention.
3. `docs/concept.md` — Notion-authored thesis: why the project exists, ten companion elements, owned tensions.

```
mcp__claudepanion__grounding_update_status({ id: "<entity-id>", status: "running", statusMessage: "synthesizing" })
```

## Step 4 — Synthesize the briefing

Write a narrative with these four sections. If `entity.input.focus` is set, open by acknowledging it and weight that topic throughout; telescope the other three sections to 1–2 sentences each.

### Section 1: The thesis

One paragraph. Why claudepanion exists — the economic claim (AI collapsed the cost of specialized software), the architectural bet (agent as the backend), what it's NOT (not CopilotKit, not LangChain, not chat UI).

### Section 2: How the pieces connect

Prose walkthrough of the live path:
- `claudepanion plugin install` → writes `enabledPlugins["claudepanion@local"]` + `extraKnownMarketplaces` to `.claude/settings.local.json` in the target repo.
- New Claude Code session reads it → connects to `http://localhost:3001/mcp` (Streamable HTTP, one transport per `initialize` request, `Mcp-Session-Id` header on subsequent calls).
- Skills at `skills/<name>/SKILL.md` (nested, literal filename) load as slash commands.
- User fills a companion's form → `POST /api/entities` writes a JSON file to `data/<companion>/<id>.json`.
- User pastes the slash command into Claude Code → Claude calls `mcp__claudepanion__*` tools to update entity state.
- UI polls `/api/entities/:id?companion=<name>` every 2s → renders state morphs (pending/running/completed/error).
- Watcher (chokidar on `companions/*/manifest.ts`) fires on file changes → debounce → re-import → `registry.remount()` → no server restart.

### Section 3: The key rules

Bullet list from `grounding.md` "rules I've repeatedly gotten wrong":
- Plugin installs to `.claude/settings.local.json` (not `.mcp.json`).
- Skills must be at `skills/<name>/SKILL.md` — nested, literal `SKILL.md`. Flat files are NOT discovered.
- `__PASCAL__` for type/component names; `__CAMEL__` for variable bindings.
- Companions must be registered in BOTH `companions/index.ts` AND `companions/client.ts` — missing `client.ts` causes "No form registered."
- Generic entity tools auto-register; `companions/client.ts` is for React renderers.
- The watcher re-imports from `dist/companions/<name>/index.js` — rebuilding is required for changes to be picked up.

### Section 4: Where to go for depth

| Topic | Pointer |
|---|---|
| Plugin wiring mechanics | `reference-architecture.md §2–4` |
| MCP Streamable HTTP session lifecycle | `reference-architecture.md §4b` |
| Tool registration pattern | `reference-architecture.md §4c` |
| Companion contract (files per kind) | Design spec at `docs/superpowers/specs/2026-04-22-claudepanion-ux-redesign-design.md §Companion contract` |
| Deferred work | `docs/followups.md` |
| Implementation history | `docs/superpowers/plans/` (Plans 1–7 + onboarding + skill hardening) |

## Step 5 — Save artifact + complete

```
mcp__claudepanion__grounding_save_artifact({
  id: "<entity-id>",
  artifact: { briefing: "<the full markdown narrative>" }
})

mcp__claudepanion__grounding_update_status({ id: "<entity-id>", status: "completed" })
```

On any error at any step:

```
mcp__claudepanion__grounding_fail({ id: "<entity-id>", errorMessage: "<short cause>" })
```
````

- [ ] **Step 4.2: Typecheck + full suite**

```bash
npm run check && npm test
```

Expected: clean and passing.

- [ ] **Step 4.3: Commit**

```bash
git add skills/grounding-companion
git commit -m "grounding: skill playbook"
```

---

## Task 5: Build + browser smoke

- [ ] **Step 5.1: Build + start server**

```bash
npm run build
PORT=3001 npm start
```

(Leave running in a separate terminal.)

- [ ] **Step 5.2: Verify companion appears**

```bash
curl -s http://localhost:3001/api/companions | python3 -m json.tool | grep name
```

Expected: both `"build"` and `"grounding"` listed.

- [ ] **Step 5.3: Smoke new + pending state in browser**

Navigate to <http://localhost:3001/c/grounding>. Verify:
- Sidebar shows 🧭 Grounding under COMPANIONS.
- Empty state shows "No entries yet" (Grounding doesn't use the Build chip-based empty state).
- Click `+ New` → form renders with a textarea labelled "Focus area (optional)".
- Submit with blank focus → pending detail page shows `/grounding-companion grounding-<hex>`.
- Submit with focus "plugin system" → pending detail page shows `/grounding-companion grounding-<hex>`.

- [ ] **Step 5.4: List row smoke**

Navigate to `/c/grounding`. Verify:
- The blank-focus entity row shows "Full overview".
- The "plugin system" entity row shows "plugin system".

- [ ] **Step 5.5: Run the slash command (optional — requires MCP session)**

In a Claude Code session with claudepanion plugin loaded and server running:

```
/grounding-companion grounding-<hex>
```

Claude should read the three docs, produce the four-section briefing, save the artifact, and mark completed. The detail page re-renders with the markdown briefing formatted (headers, bullets, table visible — not raw text).

- [ ] **Step 5.6: Commit plan completion + push**

```bash
git add docs/superpowers/plans/2026-04-24-grounding-companion.md
git commit -m "plan: grounding companion — plan doc"
git push origin feat/companion-tooling
```
