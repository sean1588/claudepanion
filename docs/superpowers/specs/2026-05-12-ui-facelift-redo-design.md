# UI Facelift Redo — Editorial · Cool

**Status:** approved 2026-05-12
**Replaces:** closed PR #19 (`ui/facelift` branch on origin) — closed because v2 contract + Option B (user-local install) landed after that work and made the wiring stale.

## Overview

Apply the **Editorial · Cool** design handoff (`/tmp/handoff/design_handoff_claudepanion/` — 14 screenshots @ 1280px, 6 prototype JSX files, full design-token spec) to the in-app surfaces. One PR, five reviewable commits. The goal is a complete visual identity (fonts, palette, sketch icons, sidebar, hero typography, hairline cards, mono terminal panes) across every screen a user touches inside the host, plus making every user-created companion inherit the look for free via the shared `CompanionForm` primitive.

The marketing landing page (handoff screen 1) is **not in scope** — different audience (visitors who haven't installed yet), probably wants to live as static content outside the SPA. It's deferred to its own thread.

## Non-goals

- Landing page (`/` marketing screen).
- Adding fields to the Build form. Screenshots 03/04 show the exact same fields we have today (mode tabs · companion name · kind · description). The README mentions a slash-command input and an MCP-tools chip picker — those don't appear in the locked screenshots and are not built.
- Server-side build-phase tracking. Step list is derived client-side from log-line patterns (see Build run detail).
- SSE / WebSocket streaming. Polling at 2s for entity detail, 5s for SystemRail.
- Widening the schema introspector to cover arrays, native `z.enum`, or nested objects. Those gaps remain as documented v2 limitations.
- Playwright / browser e2e visual tests. Visual review is manual against the handoff screenshots.
- Accessibility audit beyond what existing tests already cover. Worth a follow-up; not in this PR.

## Visual direction

Editorial, not dashboard-y. Field-guide pamphlet rather than SaaS app. All tokens from the handoff README, locked for production:

**Fonts (Google Fonts):**
- Display: Instrument Serif (Regular, Italic) — hero phrases at 56–96px, italic accent words
- Body: Inter (300–700) — UI text, body copy, captions
- Mono: JetBrains Mono (400–600) — terminal blocks, command tags, version stamps, eyebrow tags

**Color tokens (`cool` palette, CSS custom properties):**

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#F1F2F1` | page background |
| `--ink` | `#15181A` | primary text, terminal chrome |
| `--muted` | `#5C6266` | secondary text, captions |
| `--accent` | `#3D6FB8` | italic display words, links, primary CTA highlight |
| `--soft` | `#DDE2DE` | card hairlines, divider rules, subtle fills |
| `--sage` | `#7A8788` | tertiary accents |

**Status colors:** success `#7BAE6B`, warning/pending `#E5A24A`, error `#E36658`, running = `--accent`.

**Traffic-light dots** (mock terminal chrome only): red `#E36658`, amber `#E5A24A`, green `#7BAE6B`.

**Type scale:**

| Role | Family | Size / weight | line-height | tracking |
|---|---|---|---|---|
| Display | Instrument Serif | 80–96 / 400 | 1.05 | -0.02em |
| H2 section | Instrument Serif | 40–56 / 400 | 1.1 | -0.015em |
| H3 sub | Inter | 18–20 / 600 | 1.3 | 0 |
| Body | Inter | 16–17 / 400 | 1.55 | 0 |
| Caption | Inter | 13–14 / 400 | 1.5 | 0 |
| Eyebrow tag | Inter | 11 / 500 UPPERCASE | 1 | 0.12em |
| Mono | JetBrains Mono | 12–14 / 400–500 | 1.5 | 0 |

**Spacing scale:** `8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 120`. Major-section vertical rhythm 96px; in-section 48px.

**Radii:** 999 (pills, buttons, status pills); 8 (cards, inputs, terminal blocks); 12 (whole panels).

**Surfaces:** prefer hairline borders `1px solid color-mix(in srgb, var(--ink) 8%, transparent)` over shadows. Shadows reserved for floating cards on the (deferred) landing hero.

**Motion:** 150ms ease-out on hover/focus; spinner only on the installing state of the Install page; no parallax, no entrance animations.

## Component map

```
src/client/
  styles.css                  rewritten — design tokens as CSS vars, type classes, button/pill/card primitives
  components/
    Sidebar.tsx               restyled — paper-bg, serif wordmark, CORE / COMPANIONS / SYSTEM sections
    SystemRail.tsx (new)      live host / MCP / plugin status dots
    BuildAside.tsx (new)      right-column contextual panel on /c/build/new
  icons/
    Sketch.tsx (new)          hand-sketched SVG icon set: Companion, Form, Slash, Wrench, Doc, Plant, Search
  pages/
    BuildHome.tsx (new)       /c/build — hero, two-mode cards, suggestions, recent builds
    EntityDetail.tsx          rewritten — header strip + step list + log pane + footer bar
    CompanionAbout.tsx        restyled — icon-square header, version+runs meta, runs table or empty state
    NewEntity.tsx             restyled — breadcrumb + eyebrow + serif headline + CompanionForm
    Install.tsx               restyled — serif headline + community-packages aside + state panels
  primitives/
    CompanionForm.tsx         restyled — every user companion inherits the editorial look on next render
  lib/
    buildSteps.ts (new)       pure derivation: LogEntry[] -> { label, status }[]
  hooks/
    useEntityPolling.ts (new) polls /api/entities/:id at 2s while pending/running

companions/build/
  form.tsx                    restyled — InputSchema unchanged

src/server/
  api-routes.ts               adds GET /api/health
```

## Stage-by-stage breakdown

Each stage is one commit, independently reviewable. All five land in the same PR.

### Stage 1 — Foundation

**Goal:** every visual primitive in place; existing screens unchanged.

**Files:**
- `index.html` — add Google Fonts `<link>`s for Instrument Serif, Inter, JetBrains Mono.
- `src/client/styles.css` — rewrite as design-token + utility set: `:root` CSS vars (`--bg`, `--ink`, `--muted`, `--accent`, `--soft`, `--sage`, `--font-display`, `--font-body`, `--font-mono`, status colors); type classes `.t-display` / `.t-h2` / `.t-eyebrow` / `.t-mono`; button classes `.btn-ink` / `.btn-ghost` / `.btn-chip`; card class `.card-hairline`; pill class `.pill`; surface backgrounds.
- `src/client/icons/Sketch.tsx` — export `Sketch.{Companion, Form, Slash, Wrench, Doc, Plant, Search}` as React components. 48×48 viewBox, 1.4-px stroke, round caps. Drawn from handoff `source/shared.jsx`.
- `src/client/components/Sidebar.tsx` — restyle: paper background, serif wordmark + mono `localhost:3001` stamp, three sections (CORE / COMPANIONS / SYSTEM). 100vh lock; "+ Install companion" anchored at bottom.
- `src/client/components/SystemRail.tsx` (new) — three status dots:
  - **host** — always green if the SPA loaded.
  - **MCP** — reuses PR #21 logic (`firstRequestAt === null` past 15s grace → red; otherwise green).
  - **plugin** — from new `/api/health.pluginInstalled` (null → muted dot, title="unknown").
- `src/server/api-routes.ts` — add `GET /api/health` returning `{ host: "running", pluginInstalled: boolean|null, mcp: { firstRequestAt, lastRequestAt } }`. Plugin detection: read `~/.claude/settings.json` (and the equivalent per-scope file) and look for `enabledPlugins.claudepanion`. If reading fails for any reason, return `null` rather than guessing.

**Acceptance:** existing screens still render unchanged (Build home is still the old `CompanionAbout`, etc.); sidebar matches the left rail in screenshot 02; all 211 existing tests green.

### Stage 2 — Build home

**Goal:** `/c/build` renders the new `BuildHome.tsx` matching screenshot 02.

**Files:**
- `src/client/pages/BuildHome.tsx` (new).
- `src/client/pages/CompanionRoute.tsx` — branch on `companion.manifest.name === "build"` to render `BuildHome` instead of `CompanionAbout`.

**Layout (top to bottom):**
1. Breadcrumb mono: `~/ build`.
2. Eyebrow pill: `THE BUILD COMPANION · CORE`.
3. Serif hero: `Hi, I'm Build — your first companion.` (the words `I'm Build` are italic, `--accent` color).
4. Body paragraph (Inter, muted, ~62ch): "I scaffold new companions from a plain-English description. Everything else you add to the sidebar came from me. Try one of the ideas below, or describe your own."
5. Eyebrow `TWO WAYS TO START`.
6. Two cards in a row:
   - **✨ NEW COMPANION** — heading "Scaffold from scratch", muted line "Describe a new companion in plain English and Build will create it."; whole card links to `/c/build/new`.
   - **⟳ ITERATE ON EXISTING** — heading "Evolve a companion", muted line "Pick a companion and describe what should change."; links to `/c/build/new?mode=iterate`.
7. Suggestion strip (3 cards): 🔎 GitHub PR reviewer, 📊 CloudWatch investigator, 📋 Linear backlog groomer. Each links to `/c/build/new?example=<slug>`.
8. Recent builds: fetch `/api/entities?companion=build`. If `[]`, render empty state ("No builds yet. The first one always feels like magic." muted, centered). Otherwise inline table (status pill / description / timestamp / "Open →").

### Stage 3 — Build form

**Goal:** `companions/build/form.tsx` matches screenshots 03/04; right aside provides contextual help.

**Files:**
- `companions/build/form.tsx` — restyle; no schema change.
- `src/client/components/BuildAside.tsx` (new) — right-column sticky aside.

**Layout:**
- Breadcrumb: `claudepanion › Build › New companion`.
- Serif hero, two variants:
  - Blank: `Build a new companion.` (the word `companion` is italic accent).
  - Prefilled: `Scaffolding 🔎 GitHub PR reviewer` (the example name in italic accent).
- Body paragraph (varies by mode).
- Mode tabs (ink-pill style, current `mode` discriminated union preserved): `✨ New companion` / `⟳ Iterate on existing`.
- Fields, in order:
  - **Companion name** — mono input, helper text "lowercase · hyphens only · starts with a letter".
  - **Kind** — two radio cards: `entity` (form, lifecycle, artifacts) / `tool` (MCP tools only, auto About page).
  - **Description** — large textarea (mono accent for the placeholder).
- Submit row: secondary "Cancel" (ghost) + primary ink-pill "Build companion" / "Iterate".

**BuildAside states:**
- Blank: "Or start from an example" — 3 chip-cards prefilling `?example=<slug>`.
- Prefilled: "Starting from example" header (sage tint), `What Build will create` mono list (manifest.ts + index.ts, types.ts, form.tsx, pages/List.tsx + Detail.tsx, server/tools.ts, skills/{slug}/SKILL.md), `After submitting` paragraph.

### Stage 4 — Build run detail

**Goal:** `EntityDetail.tsx` matches screenshots 05–08 for the Build companion. Non-Build companions get the same shell minus the step list.

**Files:**
- `src/client/pages/EntityDetail.tsx` — rewrite.
- `src/client/lib/buildSteps.ts` (new) — pure `deriveSteps(entity): { label, status }[]`.
- `src/client/hooks/useEntityPolling.ts` (new) — `setInterval` at 2s while pending/running; clears on terminal state, unmount, or `document.hidden`.

**Anatomy:**
- **Header strip:** entity name (serif, large), meta line (`Started 2s ago · ID build-f05218`), state pill (pending = amber dot, running = blue spinner, completed = green dot, error = red dot).
- **Status block** (mono terminal-style) showing current step copy from the latest log line (e.g. `writing skills/github-pr-reviewer/SKILL.md`).
- **Slash command pill** — existing copy/value, restyled.
- **Step list** (Build companion only): 6 entries — `Reading prompt`, `Designing companion shape`, `Generating form schema`, `Wiring MCP tools`, `Writing skill`, `First boot`. Each row: sketch icon + label + status indicator (pending / active spinner / done check / failed cross).
- **Log pane:** dark `--ink` background, light `--bg` text, JetBrains Mono. Renders existing `LogEntry[]` in chronological order, auto-scrolls to bottom while running. Header shows `Logs · polling every 2s`.
- **Footer bar:** "Cancel build" (muted text link) on the left; "Open companion →" primary ink-pill on the right, accent-blue + enabled only when `status === "completed"`.

**Error state:** failing step gets a red `×`; the matching log lines highlight red; an error panel renders below with the artifact's `errors[]` plus "Retry build" + "Edit prompt" links.

**`buildSteps.ts` derivation rules** (case-insensitive substring on `LogEntry.message`):

| Pattern | Step |
|---|---|
| `reading prompt` / `loaded entity` | Reading prompt |
| `drafting manifest` / `designing` | Designing companion shape |
| `form schema` / `writing types` | Generating form schema |
| `writing companions/` / `wiring tools` / `server/tools` | Wiring MCP tools |
| `writing skills/` | Writing skill |
| `running validator` / `validator passed` | First boot |

Step status:
- `pending` if no log line has matched it yet.
- `active` if it's the most recent matched step and entity status is pending/running.
- `done` if any later step has matched.
- `failed` if entity status is `error` and this is the latest matched step.

If `entity.companion !== "build"`, skip the step list and render only the log pane.

### Stage 5 — CompanionAbout + Install + CompanionForm primitive

**Goal:** generic companion shell, install page, and user-companion forms all inherit the new look.

**Files:**
- `src/client/pages/CompanionAbout.tsx` — restyle.
- `src/client/pages/Install.tsx` — restyle.
- `src/client/primitives/CompanionForm.tsx` — restyle inputs / textareas / selects / radios / buttons / errors. No logic change. All seven `ui.kind` branches (`text` / `textarea` / `password` / `select` / `searchableSelect` / `datetime` / `slider`) get the editorial look.
- `src/client/pages/NewEntity.tsx` — wrapper: breadcrumb + eyebrow + serif headline + render `CompanionForm`.

**CompanionAbout (screenshots 09/10):**
- Breadcrumb (`claudepanion › <Companion name>`).
- Icon-square header (Sketch icon at 96×96 in a `--soft` square, 8px radius) + serif name (40px) + one-line description + mono meta `v0.1.0 · entity · 4 runs`.
- CTAs row: ghost-pill "🔨 Iterate with Build" (→ `/c/build/new?mode=iterate&target=<slug>`), ink-pill "+ New run" (→ `/c/<slug>/new`).
- Runs table: status pill column, description column, mono timestamp column, "Open →" link. Showing-N-runs · show-all footer.
- Empty state: faint `Sketch.Plant` at large scale + muted text "Past runs will live here."

**Install (screenshots 11–14):**
- Breadcrumb, eyebrow `INSTALL FROM npm`.
- Serif hero: `What would you like to install?`.
- Mono input prefixed with `$ npx claudepanion install` — accepts `claudepanion-<slug>`.
- Right aside: **Community packages** — 4 cards (placeholder `claudepanion-pr-reviewer`, `claudepanion-oncall`, `claudepanion-linear-grooming`, `claudepanion-rss-summarizer`), each with author / version / downloads / "Install" pill (clicking prefills the input).
- Below input: small note linking to `https://npmjs.com/search?q=claudepanion-`.
- State panels (inline, replace input area):
  - **Idle:** input ready; aside visible.
  - **Installing:** feedback block showing the running npm command + spinner; previous output streams in mono.
  - **Success:** green border, ✓, `Installed claudepanion-pr-reviewer v1.2.3 — Open companion →`.
  - **Error:** red border, ×, npm error reproduced verbatim in mono.

Existing wiring (`POST /api/install`) unchanged.

## Data flow and API touchpoints

**New endpoint:**
- `GET /api/health` — `{ host: "running", pluginInstalled: boolean|null, mcp: { firstRequestAt, lastRequestAt } }`. Backs the SystemRail.

**Existing endpoints reused, no changes:**
- `GET /api/companions` — sidebar.
- `GET /api/entities?companion=<slug>` — BuildHome recent-builds + CompanionAbout runs.
- `GET /api/entities/:id` — EntityDetail (polled at 2s while pending/running).
- `GET /api/mcp/status` — MCP dot (PR #21).
- `GET /api/companions/:name/input-schema` — drives `CompanionForm`; restyle is presentational, descriptor pipeline unchanged.
- `POST /api/install` — Install page state changes.

**Client-side derivation:**
- `lib/buildSteps.ts` — pattern table above.
- `hooks/useEntityPolling.ts` — 2s while pending/running; clears on terminal state / unmount / `document.hidden`.

**Polling cadence:** 2s for entity detail, 5s for SystemRail. No SSE/WebSocket.

## Edge cases and errors

- **Step list on non-Build companions:** skip it entirely. Render log pane alone.
- **Pattern drift in Build skill:** caught by `tests/client/buildSteps.test.ts` fixture; update the single pattern table when the skill changes log copy.
- **Empty `LogEntry[]`:** step list all-muted, log pane shows "Waiting for agent…" placeholder.
- **SystemRail plugin detection failure:** dot stays muted with `title="unknown"`. Never assume green on undetectable.
- **MCP dot:** PR #21 logic verbatim.
- **`useEntityPolling` cleanup:** clears on unmount, terminal state, and `document.hidden` (don't poll backgrounded tabs).
- **Suggestion-card 404 on Build home:** unknown `?example=<slug>` falls back to a blank "New companion" form, no error.
- **Install package-name validation:** existing `^claudepanion-[a-z0-9-]+$` check stays. Failure → inline error panel with the npm 404 message verbatim.
- **Form fields outside `string|number|boolean`:** introspector still drops them; the affected NewEntity page renders the existing "no form available" placeholder. Not in scope to fix.

## Testing

**Unit (vitest, node env):**
- `tests/client/buildSteps.test.ts` — `LogEntry[]` fixture captured from a real Build run, snapshot the derived `{label, status}` sequence at 5 lifecycle points (pending / mid-run / writing-skill / completed / errored).
- `tests/server/health.test.ts` — `GET /api/health` returns the expected shape across all three `pluginInstalled` branches (installed / not installed / undetectable → `null`).

**Component (vitest + jsdom):**
- `tests/client/BuildHome.test.tsx` — hero + two mode cards + 3 suggestions; suggestion click navigates to `/c/build/new?example=<slug>`; empty state renders on `[]` response.
- `tests/client/EntityDetail.facelift.test.tsx` — step list + log pane render for a running fixture; "Open companion →" disabled when `status !== "completed"`; error panel only on `status === "error"`.
- `tests/client/Sidebar.test.tsx` — CORE / COMPANIONS / SYSTEM sections render; SystemRail dots reflect mocked `/api/health` + `/api/mcp/status`.
- `tests/client/CompanionForm.test.tsx` — extend existing: restyled output still validates the same schemas. Cover datetime, static-options select, `optionsFrom` select.

**Visual smoke (manual, per stage):**
- After each commit, eyeball the matching handoff screenshot side-by-side with `npm run dev` and document any pixel deltas in the PR description.
- Final pass: take fresh screenshots of all 5 in-app screens, paste into the PR body, diff against `screenshots/`.

**Existing 211 tests:** stay green at every stage. Any regression reverts before the stage proceeds.

## Open questions

None remaining. All resolved during brainstorming:
- Scope: 5 in-app screens, landing deferred (decided).
- Approach: design handoff package as source of truth, not porting PR #19 (decided).
- PR strategy: one PR, 5 staged commits (decided).
- Build form fields: restyle only, no schema change (decided — screenshots confirmed current fields).
- Build run step list: log-pattern-derived (decided).

## Files in the handoff bundle

```
/tmp/handoff/design_handoff_claudepanion/
├── README.md
├── screenshots/                 14 PNGs at 1280px wide
│   ├── 01-landing-page.png      (deferred — out of scope)
│   ├── 02-build-home.png
│   ├── 03-build-form-blank.png
│   ├── 04-build-form-prefilled.png
│   ├── 05–08-detail-*.png       4 states
│   ├── 09–10-companion-*.png    empty / populated
│   └── 11–14-install-*.png      4 states
└── source/                      React-via-Babel prototypes (visual reference; do not ship)
    ├── shared.jsx               COPY + Sketch icons (lift)
    ├── build-home.jsx           BuildHomeEditorial
    ├── build-form.jsx           BuildFormEditorial
    ├── build-detail.jsx         DetailPageA
    ├── companion-home.jsx       CompanionHomeEditorial
    └── install-page.jsx         InstallEditorial
```

`direction-b.jsx`, `design-canvas.jsx`, `tweaks-panel.jsx` are not used — design-time tooling only.
