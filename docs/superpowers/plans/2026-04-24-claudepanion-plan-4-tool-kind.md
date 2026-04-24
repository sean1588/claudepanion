# Plan 4 — Tool-kind Companions + Auto About Page

**Goal:** Land the second companion kind. Tool-kind companions have MCP tools only — no entities, no lifecycle, no hand-written pages. The host reads `manifest.ts` + annotated tool functions and renders a working About page with a live Try-it panel. Ship `homelab` as the reference tool companion.

**Key design choice:** Since Node ESM has no runtime type info, tool metadata comes from a `.meta` property attached to the handler function (non-breaking — existing expense-tracker tools work unchanged). Tools that don't attach metadata get a generic `{}` JSON input on the About page.

---

## Task 1 — ToolMeta type + annotation helper

**Files:** `src/server/companion-registry.ts`, `src/server/tool-meta.ts`

Add `ToolMeta` interface and a `defineTool(handler, meta)` helper that returns a tagged handler. Update `ToolHandler` type doc to note the optional `.meta` property.

## Task 2 — Tool-kind registry + MCP

**Files:** `src/server/mcp.ts` (already handles kind === entity gate).

Nothing to change — `buildCompanionHandlers` already skips generic entity tools for non-entity kinds. Verify via test.

## Task 3 — Homelab reference companion

**Files:** `companions/homelab/{manifest.ts, index.ts, server/tools.ts}`

- Manifest: name `homelab`, kind `tool`, icon 💡.
- Tools: `homelab_lights_on(room: string)`, `homelab_lights_off(room: string)`, `homelab_status()`. Each annotated via `defineTool`. Implementations are stubs returning synthetic state so Try-it has something to display.

## Task 4 — Tools REST surface

**Files:** `src/server/api-routes.ts`

- `GET /api/tools/:companion` → `{ manifest, tools: [{ name, description, params }] }`. 404 if unknown. 400 if kind !== "tool".
- `POST /api/tools/:companion/:tool` body `{ args }` → runs handler, returns `{ ok, result | error }`.

## Task 5 — Auto About page

**Files:** `src/client/pages/ToolAbout.tsx`, update `src/client/App.tsx` router.

About page layout per spec:
- Header: icon + displayName + version + description + package name (`claudepanion-<name>`).
- MCP tools list: name, signature (synth from params), description.
- Try-it panel: tool dropdown; on select, render inputs from param schema (string → text, number → number, boolean → checkbox, enum → select); Invoke button; result rendered in a dark JSON block.

Route: `/c/:companion` for tool kind → ToolAbout; entity kind → EntityList (already exists). Fork inside the existing route component by looking at the manifest.

## Task 6 — Sidebar tool section

**Files:** `src/client/components/Sidebar.tsx`

Sidebar already filters `kind: "tool"` into its own section — just verify it renders.

## Task 7 — Build templates for tool kind

**Files:** `companions/build/templates/tool/{manifest.ts, index.ts, server/tools.ts}`

Mirror of entity templates, but without form/pages/types. Update the skill playbook's mode: "tool" branch to use these templates (previously stubbed as "lands in plan 4").

## Task 8 — Browser smoke

Navigate to `/c/homelab`. Verify About page renders with 3 tools listed, signatures correct. Invoke each tool via Try-it, confirm JSON result panel.
