# Build First-Run Onboarding — Design Spec

**Date:** 2026-04-24
**Status:** Draft for implementation
**Companion concept:** see `docs/concept.md`
**Supersedes:** the onboarding section of `docs/followups.md`

## Problem

A fresh claudepanion install shows an empty Build list page and nothing else. Users with no context don't know:

1. What claudepanion *is for* (discovery).
2. How to phrase a good prompt so Build can scaffold something useful (framing).
3. That Build itself is a companion, and that's the conceptual unit.

The earlier shipped experience masked this by pre-installing Expense Tracker and Homelab as demos. Those were verification fixtures, not demos — Homelab was a mock that actively misled users — and we pulled them for that reason. What's left is honest but bare.

## Goal

Turn the Build empty-state into a short, self-contained first-run experience that:

- Names Build as a companion in its own words.
- Gives the user 5 concrete starting-point ideas, each chosen because the companion frame actually buys something.
- Gets them into the New-companion form with a prefilled description in one click.
- Disappears once any Build run exists, so regulars see the normal list.

## Non-goals (v1)

- Multi-step tour / walkthrough / tooltip sequence.
- Animated transitions in/out of the empty state.
- Per-companion onboarding for future companions (this spec is only about the Build first-run).
- Remote/fetched example catalog. Examples are hard-coded in the repo for now.
- A tool-kind example among the chips. All examples are entity-kind; tool kind stays discoverable via Build's own kind selector.

---

## Architecture

### Layout

The Build empty-state (shown when `fetchEntities("build")` returns `[]`) composes four elements stacked vertically in the main area:

1. **Page header** — already exists. Shows "Build" title, breadcrumb "Core / Build", and two CTAs: `⟳ Iterate on existing` (secondary) + `+ New companion` (primary). Unchanged.

2. **Welcome block** — new. First-person greeting from Build with a one-paragraph explainer. Light-blue gradient background, icon, warm tone.

3. **Chip grid** — new. Five entity-kind example prompts in a 2-column grid. Chip #5 spans both columns since 5 is odd.

4. **"or" divider + "+ New companion" button** — new. Subtle divider, then a large primary button so the user who skipped the examples has a clear CTA at the bottom. Duplicates the header's primary CTA intentionally — easy to drop in a later polish pass.

When there is ≥1 Build entity, elements 2/3/4 are hidden and the normal list renders as it does today.

### Voice

Build speaks in first person. The welcome block reads:

> **👋 Hi, I'm Build — your first companion.**
> I scaffold new companions from a plain-English description. Everything else you add to the sidebar came from me. Try one of the ideas below, or describe your own.

Rationale: personifying Build sets the metaphor for the rest of the product. Every companion the user adds later speaks with its own voice through its own UI. Starting that pattern on screen one teaches the vocabulary.

---

## Data model

Examples live in a new TS module `companions/build/examples.ts`:

```ts
export interface BuildExample {
  slug: string;          // "pr-reviewer"
  kind: "entity" | "tool";
  displayName: string;   // "PR reviewer"
  icon: string;          // "🔎"
  description: string;   // Visible on the chip AND the seed for the form
}

export const buildExamples: BuildExample[] = [ /* 5 entries */ ];
```

The description does double duty: it's the visible text on the chip and the prefilled value in the form's description textarea on click.

### The five examples

Each chosen because repeatability + persistent artifact + continuation flow + Claude-as-backend all add value. None require new MCP proxy companions — Claude's built-in Read/Grep/Bash are enough.

| slug | kind | icon | displayName | description |
|---|---|---|---|---|
| `pr-reviewer` | entity | 🔎 | PR reviewer | Review a PR in this repo, flag risky diffs, and suggest questions to ask the author. |
| `release-notes-drafter` | entity | 📝 | Release notes drafter | Generate user-facing release notes from merged PRs in a git range. |
| `codebase-onboarding-doc` | entity | 🧭 | Codebase onboarding doc | Read this repo and write a "how to get oriented" doc for new contributors. |
| `design-doc-reviewer` | entity | 🪓 | Design doc reviewer | Critique a pasted design doc: flag ambiguities, missing constraints, unstated assumptions. |
| `postmortem-writer` | entity | 🕯️ | Postmortem writer | Turn a pasted incident timeline into a structured postmortem: impact, root cause, action items. |

Future additions: edit the file. No runtime configuration plumbing.

---

## Click behavior

Clicking a chip navigates to `/c/build/new` with the chip's fields preserved as query params:

```
/c/build/new?example=pr-reviewer
```

The NewEntity page reads `?example=<slug>`, looks up the example in `buildExamples`, and prefills the form:

- `name` → `example.slug`
- `kind` → `example.kind`
- `description` → `example.description`

All three fields remain editable. The user can (and should) add context — e.g., pin the PR reviewer to a specific repo path, or bump the slug to avoid a collision. No submission happens until the user hits **Scaffold companion**.

Rationale: prefill-and-edit walks the user through the real form — which is what every later companion creation will use — while giving them a concrete starting point. One-click-create would feel snappier but the resulting entity would be too generic to be useful, and the user misses the form entirely.

---

## Empty-state gating

The Welcome + Chip grid + `+ New companion` button render only when:

- The current companion is `build`, AND
- The entity list fetched from `/api/entities?companion=build` is empty (length 0).

Once any Build entity exists, the standard list view renders — same as every other entity companion. The empty-state is one-shot per install. A user who deletes all their Build entities will see the onboarding again, which is acceptable.

Extracted as a stand-alone `<BuildEmptyState />` component. `EntityList` renders it when `companion === "build" && entities.length === 0`.

---

## Files touched

- **New:** `companions/build/examples.ts` — the typed example catalog (≈50 lines).
- **New:** `src/client/pages/BuildEmptyState.tsx` — the welcome + chip grid + button composition. Imports `buildExamples`.
- **Modify:** `src/client/pages/EntityList.tsx` — branch to render `<BuildEmptyState />` on the `build` empty case.
- **Modify:** `companions/build/form.tsx` — read `?example=<slug>` on mount; if present, look up the example in `buildExamples` and prefill name/kind/description. Fall back to current behavior (empty form) if param is missing or slug doesn't match.

Total scope: ≈120 lines of new code plus minor edits to two existing files. No server changes, no migrations, no new API surface.

---

## Testing

- Unit: BuildEmptyState renders all five chips. Each chip's `onClick` navigates to the expected `/c/build/new?example=<slug>`.
- Unit: NewEntity page with `?example=pr-reviewer` prefills the Build form with the `pr-reviewer` values. Invalid `?example=doesnt-exist` falls back to empty form (no crash).
- Unit: EntityList renders the empty-state when `companion === "build"` and there are no entities; renders the normal list otherwise.
- E2E smoke (manual): nav to `/c/build` on a fresh install, click a chip, verify prefill, hit Scaffold, verify pending page.

No server tests needed — this is a client-only change.

---

## Open questions (deferred)

1. **Editable examples at runtime.** Future users may want to add/remove chips without editing TS. Deferred — the TS module is the simplest thing that works.
2. **"Surprise me" button.** The original followups noted this; we decided against it for now because the chip grid already surfaces the full list with less interaction friction. Reconsider if we scale to 20+ examples.
3. **Empty-state analytics.** Would be nice to know which chips get clicked vs. ignored. No analytics infra in claudepanion today; punt.
4. **Re-running onboarding on demand.** A user who wants to see the chips again after deleting all their Build entities gets them automatically. No "always show" toggle is planned.

---

## Success criteria

- A user on a fresh install sees the welcome block + 5 chips on first visit to `/c/build`.
- Clicking any chip lands them on the New companion form with all three fields prefilled and editable.
- Submitting the form creates a Build entity and navigates to the pending detail page as it does today.
- After one Build entity exists, the empty-state disappears on subsequent visits to `/c/build`.
- No regressions in typecheck, lint, tests, or existing browser-verified flows.
