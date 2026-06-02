# Headless companions — design

**Status:** approved (brainstorm), pending implementation plan
**Date:** 2026-05-30

## Problem

Today, every UI companion's entity is driven the same way: the user submits a
form in the browser, the host shows a slash command (`/<slug>-companion <id>`),
and the user pastes it into their **interactive** Claude Code session, which
drives the entity through the companion's MCP tools.

That interactive flow is genuinely valuable for some tasks — anything where the
user wants to steer, ask follow-ups, or guide a long-running investigation. But
for fire-and-forget tasks it imposes real friction: a context switch from the
browser to a terminal, and dependence on the plugin/slash-command plumbing
(marketplace registration, `claude plugin install`, "restart your session before
the new command appears"). For those tasks the user just wants to submit the
form and watch the result.

## What we're adding

A second way to *launch* a UI companion's entity: **headless**. Instead of the
human pasting a slash command, the **host** runs `claude -p` itself, pointed at
the same skill and the same MCP tools. The entity then proceeds exactly as it
does today — same entity store, same `<slug>_*` MCP tools, same polling UI, same
artifact. The only thing that changes is **who invokes Claude: the host instead
of the human.**

This is a launch mechanism, not a second execution engine. Everything downstream
of the spawn is unchanged.

### Key consequence: headless sidesteps the plugin-plumbing gap

Because the host constructs the whole invocation, a headless companion does
**not** depend on the slash command, the installed plugin, or the MCP config
being loadable in the user's cwd. The host inlines the skill's instructions via
`--append-system-prompt`, passes the entity payload as the prompt, and points
`--mcp-config` at the companion's own config. None of the plumbing we fought in
PR #25 is on the critical path for headless companions.

## Goals

- Let a UI companion run end-to-end from the browser with no terminal step.
- Reuse the entire existing entity lifecycle (store, MCP tools, polling,
  artifact). No new execution model.
- Keep the interactive (slash-command) flow as a first-class, equal mode — it is
  the *correct* mode for steer-and-converse tasks, not a fallback.
- Make headless **safe by default**: bounded to the companion's sanctioned MCP
  tools, never arbitrary code execution.

## Non-goals

- **No `--dangerously-skip-permissions` path in v1.** No escape hatch to force
  headless on a companion that needs raw `Bash`/`Write`. If a real companion
  later proves it needs that, we add it deliberately, behind its own explicit
  opt-in.
- **No hybrid "headless that pauses to ask for input" mode.** Fire-and-forget
  headless OR full interactive — no middle mode. (The Agent SDK supports mid-run
  prompts; that's a deliberate future, not v1.)
- **Tool-kind companions are unaffected** — they have no entity lifecycle, so
  `execution` is meaningless for them.

## Design

### 1. Manifest field

Add an optional field to `Manifest` (`src/shared/types.ts`):

```ts
/** How a ui-kind entity is driven. Default: "interactive" (slash command). */
execution?: "interactive" | "headless";
```

- Undefined ⇒ `"interactive"`. Existing companions are unchanged; no contract
  version bump required (additive optional field).
- Only meaningful for `kind: "ui"`. The validator should warn (not error) if a
  `tool`-kind manifest sets it.

### 2. Authoring — the Build form + skill

The mode is chosen **at authoring time** by the companion's author, in the
structured Build form (ui-kind branch only):

- A toggle: **Interactive (slash command)** vs **Headless (runs from the UI)**.
- `serializeBuildPrompt()` includes the choice; the build skill writes
  `execution: "headless"` (or omits it for interactive) into the generated
  `manifest.ts`.
- Guidance copy next to the toggle, framed on **task shape** first:
  - *"Want to steer it, ask follow-ups, or guide a long investigation? →
    Interactive."*
  - *"Fire-and-forget, watch the result in the browser, never touch the
    terminal? → Headless."*
  - Honest caveat: *"Headless runs unattended, on your Claude Code auth, using
    only this companion's tools — no human approves each step."*

### 3. The headless runner (one new bounded unit)

New module: `src/server/headless-runner.ts`. Single responsibility: given a
pending entity for a headless companion, run Claude and stream its output into
the entity log.

Hook point: `POST /api/entities` (`api-routes.ts:161`). After `store.create`,
if `registry.get(companion).manifest.execution === "headless"`, hand the entity
to the runner (fire-and-forget; the route still returns 201 immediately, UI
polls as today).

The runner spawns:

```
claude -p "<entity payload prompt>" \
  --append-system-prompt "<inlined SKILL.md instructions>" \
  --mcp-config <~/.claudepanion/.mcp.json or per-run config> \
  --strict-mcp-config \
  --allowedTools "mcp__claudepanion__<slug>_*" \
  --output-format stream-json --include-partial-messages
```

- `--strict-mcp-config` ⇒ the run sees **only** the companion's MCP server.
- `--allowedTools` ⇒ bounded to the companion's own tools (+ read-only as
  needed). Default permission mode; non-allowed tools are denied (loud, safe) —
  no `--dangerously-skip-permissions`.
- Parse the stream-json and append to the entity log via the existing
  `_append_log` path. The entity transitions pending→running→completed/error
  driven by the MCP tools the headless Claude calls — identical to interactive.

Process lifecycle (the runner owns this):
- Track the child process by entity id.
- Entity cancel ⇒ kill the process.
- Timeout ⇒ kill + mark entity error.
- Process crash / non-zero exit without a terminal MCP call ⇒ mark entity error
  (via `_fail` / store).
- Concurrency cap (small semaphore) so a burst of submissions can't fork-bomb
  the host. Default cap chosen at implementation time.

### 4. Submit-time UI

A single boundary branch on `manifest.execution`:

- **Headless** ⇒ submit transitions straight to the running view; watch live. No
  slash command shown.
- **Interactive** ⇒ submit shows the slash command (today's behavior).

This is a feature flag at the boundary, not scattered dispatch.

### 5. The Build companion stays interactive

Build is itself a ui-kind companion. Its `execution` is **interactive** (omits
the field). This is correct, not an exception: Build writes files and runs
`claudepanion scaffold` (bash), and its loop is conversational (describe →
scaffold → look → refine → "now change X"). That's the textbook "reaches into
the environment + you want to steer it" shape, which our allowlist rule keeps
out of headless — running Build headless would mean granting `Write`/`Bash` to
an agent spawned by a form POST, the exact footgun this design refuses.

Build's *new* responsibility is at the authoring layer: it is the tool that
writes the `execution` field into **other** companions' manifests (via the form
toggle in §2). It is interactive itself; it confers headless-ness on others. It
is not a special dual-mode companion.

> Future note: if Build ever authored files through sanctioned MCP tools
> (issue #23, MCP-mediated writes) instead of raw `Write`/`Bash`, it would be
> confined to the allowlist and *could* go headless. Out of scope here, and
> interactive is likely the right default for Build regardless.

## Security considerations

- **Bounded blast radius by construction.** Headless never gets `Bash`/`Write`
  to arbitrary paths; it is restricted to the companion's `mcp__claudepanion__*`
  tools via `--allowedTools` + `--strict-mcp-config`. The residual risk is
  "runs unattended and spends tokens," plus whatever those tools can already do
  by design.
- **Auto-execution on POST.** Headless changes `POST /api/entities` from "create
  a pending record" to "create a record *and* spawn an agent." Confirm the host
  binds localhost only, and consider an origin/`Host`-header check on the entity
  route so a malicious web page can't trigger headless runs cross-origin. The
  bounded allowlist limits damage even if one slips through, but defense in
  depth is cheap here.
- **Auth/billing.** Headless uses the machine's logged-in `claude` auth. Token
  spend happens server-side and is invisible to any interactive session — noted
  in the UI guidance copy.

## Testing

- Manifest: `execution` defaults to interactive when absent; validator warns on
  `tool`-kind misuse.
- Runner: builds the expected `claude -p` argv (allowlist, strict-mcp-config,
  no skip-permissions); maps stream-json → log entries; cancel kills the
  process; crash marks the entity error; concurrency cap holds.
- Route: headless companion ⇒ runner invoked after create; interactive
  companion ⇒ runner NOT invoked.
- UI: headless submit shows the running view (no slash command); interactive
  submit shows the slash command.
- Build form: toggle round-trips through `serializeBuildPrompt()`; build skill
  emits `execution: "headless"`.

## Deferred / open

- `--dangerously-skip-permissions` escape hatch (explicitly out of v1).
- Scoped-`Bash`/`Write` headless companions (would need the allowlist-scoping
  safety questions answered first).
- Headless Build via issue #23 (MCP-mediated writes).
- Concurrency cap default value — decided at implementation.
