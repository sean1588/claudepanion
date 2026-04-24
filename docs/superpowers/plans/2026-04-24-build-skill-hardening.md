# Build Skill Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a first-run Build companion scaffold reliably produce a working companion. Close every rationalization path that led to the PR-reviewer failure (curl fallbacks, skipped registrations, TODO-stub skills, mis-cased types). Bring the build-companion skill up to oncall-investigator's prescriptiveness.

**Architecture:** Four tiers tackled in one plan. Tier 4 (plugin wiring) first because it blocks everything downstream. Tier 2 (templates) next because the rewritten skill references the new tokens. Tier 3A (chip `skillTemplate` field) third because it feeds into the rewritten skill. Tier 1 (skill rewrite) last, consuming all of the above. End-to-end smoke validates the full chain.

**Tech Stack:** Node + ESM CLI, React 18 + Vite 6 client, Express + MCP SDK server, vitest tests. No new deps.

**References:**
- Existing reference architecture: [`reference-architecture.md`](../../../reference-architecture.md)
- Reference skill to emulate: `/home/sean/projects/oncall-investigator/skills/oncall-investigate/SKILL.md` (read thoroughly before Task 4)
- Writing-skills principles: strict prescriptiveness, close loopholes explicitly, exact tool-call syntax, common-mistakes section, red-flags list. Description = triggering conditions, not workflow summary.

---

## File structure

| Path | Responsibility |
|---|---|
| `bin/cli.js` (modify) | Stop writing `disabledMcpjsonServers`; keep only the two install keys. Verify uninstall symmetry. |
| `companions/build/templates/entity/*` (modify) | Rename `__CAMEL__` → split into `__CAMEL__` (variable names) + `__PASCAL__` (type names). Rewrite `skill.md` template body so the scaffolded companion's skill is minimal-working, not TODO-stub. |
| `companions/build/templates/tool/*` (modify) | Same token update if they reference casing. |
| `companions/build/examples.ts` (modify) | Extend `BuildExample` with optional `skillTemplate` field. Fill in for all 5 chip entries. |
| `skills/build-companion/SKILL.md` (rewrite) | Match oncall-investigator's style. Strict MCP-only guardrails. Exact syntax per step. Verification step. Common mistakes section. Handling of `skillTemplate` for examples. |
| `tests/client/build-examples.test.ts` (modify) | Extend shape test to cover optional `skillTemplate` field. |
| `docs/troubleshooting.md` (modify) | Correct the `/build-companion` entry with the diagnostic checklist surfaced in Task 1. |

Note on Tier 1: the skill rewrite is documentation, not code. We don't have a practical way to run writing-skills' formal RED/GREEN/REFACTOR pressure scenarios here. Our "tests" for the skill are the end-to-end smokes in Task 5 (scaffold a real companion through Build and verify it works on first run).

---

## Task 1: Diagnose + fix plugin wiring (Tier 4)

**Files:**
- Modify: `bin/cli.js`
- Possibly touch: `.gitignore` (already set; no change expected)

This unblocks everything else. The user reported `/mcp` showed "connection failed" and `/plugin` showed "needs attention" — MCP tools were missing from Claude's session, which is why the skill's MCP tool calls got rewritten as curl. Most likely cause: my CLI's `disabledMcpjsonServers: ["claudepanion"]` entry is disabling both the cwd `.mcp.json` *and* the plugin's own `.mcp.json`.

- [ ] **Step 1.1: Read the current install helper**

The current `bin/cli.js` writes three keys into `.claude/settings.local.json`:

```js
settings.enabledPlugins["claudepanion@local"] = true;
settings.extraKnownMarketplaces.local = { source: { source: "directory", path: pkgRoot } };
if (!settings.disabledMcpjsonServers.includes("claudepanion")) {
  settings.disabledMcpjsonServers.push("claudepanion");
}
```

- [ ] **Step 1.2: Remove the `disabledMcpjsonServers` write**

The oncall-investigator reference *commits* `.claude/settings.local.json` with `disabledMcpjsonServers` for repo devs. We gitignore ours, so adding that field at install time is broader than the dev-machine intent and plausibly shadows the plugin's MCP entry. Delete the `disabledMcpjsonServers` block from `pluginInstall()` and the matching filter from `pluginUninstall()`. Install becomes:

```js
function pluginInstall() {
  const gitRoot = findGitRoot();
  if (!gitRoot) die("Error: not inside a git repository");

  const settingsPath = join(gitRoot, ".claude", "settings.local.json");
  const settings = readJson(settingsPath) ?? {};

  settings.enabledPlugins ??= {};
  settings.enabledPlugins["claudepanion@local"] = true;

  settings.extraKnownMarketplaces ??= {};
  settings.extraKnownMarketplaces.local = {
    source: { source: "directory", path: pkgRoot },
  };

  writeJson(settingsPath, settings);
  console.log("✓  Plugin installed in Claude Code");
  console.log(`   Plugin directory: ${pkgRoot}`);
  console.log(`   Settings: ${settingsPath}`);
  console.log("\n   Start a new Claude Code session for the plugin to load.");
}

function pluginUninstall() {
  const gitRoot = findGitRoot();
  if (!gitRoot) die("Error: not inside a git repository");

  const settingsPath = join(gitRoot, ".claude", "settings.local.json");
  const settings = readJson(settingsPath);
  if (!settings) { console.log("Nothing to uninstall."); return; }

  if (settings.enabledPlugins) delete settings.enabledPlugins["claudepanion@local"];
  if (settings.extraKnownMarketplaces) delete settings.extraKnownMarketplaces.local;

  writeJson(settingsPath, settings);
  console.log(`✓  Plugin removed from Claude Code (${settingsPath})`);
}
```

If working inside the claudepanion repo itself where the cwd `.mcp.json` would otherwise double-register, the developer can add `{"disabledMcpjsonServers": ["claudepanion"]}` manually to their local `.claude/settings.local.json` — or we can commit a repo-level `.claude/settings.json` later if needed. For end users in other repos, the cwd has no `.mcp.json`, so double-registration isn't a risk.

- [ ] **Step 1.3: Scratch-repo install test**

```bash
TEST=$(mktemp -d); cd "$TEST" && git init -q
/home/sean/projects/claude-manager/bin/cli.js plugin install
cat .claude/settings.local.json
```

Expected: JSON has ONLY `enabledPlugins["claudepanion@local"]: true` and `extraKnownMarketplaces.local`. No `disabledMcpjsonServers` key.

- [ ] **Step 1.4: Round-trip uninstall test**

```bash
/home/sean/projects/claude-manager/bin/cli.js plugin uninstall
cat .claude/settings.local.json
```

Expected: both keys removed; `disabledMcpjsonServers` still absent.

- [ ] **Step 1.5: Real-session verification (manual)**

After Task 5's rebuild:
1. `claudepanion plugin uninstall` in the test target repo (wipe any previous wiring).
2. `claudepanion plugin install` (fresh).
3. Start `claudepanion serve` in another terminal.
4. Start a NEW Claude Code session in the target repo.
5. Run `/plugin` — `claudepanion@local` should show as loaded, not "needs attention."
6. Run `/mcp` — `claudepanion` server should be connected, not "connection failed."
7. Ask Claude in the session: *"What MCP tools do you have from claudepanion?"* — should list `build_get`, `build_list`, `build_update_status`, etc., plus domain tools.

- [ ] **Step 1.6: Commit**

```bash
git add bin/cli.js
git commit -m "cli: stop writing disabledMcpjsonServers at plugin install

The entry was meant to suppress cwd .mcp.json double-registration
when developing inside the claudepanion repo, but name-based disable
also appears to shadow the plugin's own MCP registration — which
produced \"connection failed\" on /mcp and forced the Build skill
to fall back to HTTP curl. Drop the write; any dev who genuinely
hits double-registration can add the key manually."
```

---

## Task 2: Template casing + working skill scaffold (Tier 2)

**Files:**
- Modify: `companions/build/templates/entity/types.ts`
- Modify: `companions/build/templates/entity/form.tsx`
- Modify: `companions/build/templates/entity/pages/List.tsx`
- Modify: `companions/build/templates/entity/pages/Detail.tsx`
- Modify: `companions/build/templates/entity/index.ts`
- Modify: `companions/build/templates/skill.md`

**Goal:** Templates emit a syntactically idiomatic working companion, not `interface prReviewerInput` nonsense.

- [ ] **Step 2.1: Introduce `__PASCAL__` as a distinct token**

`__NAME__` stays as the slug. `__CAMEL__` stays for variable names (e.g. `prReviewer`). Add `__PASCAL__` for type and component names (e.g. `PrReviewer`, `PrReviewerInput`, `PrReviewerForm`).

Substitution rule the skill will spell out (Task 4): `__PASCAL__` = first char of `__CAMEL__` uppercased. `pr-reviewer` → camel `prReviewer` → pascal `PrReviewer`.

- [ ] **Step 2.2: Update entity templates**

`companions/build/templates/entity/types.ts`:

```ts
export interface __PASCAL__Input {
  description: string;
}

export interface __PASCAL__Artifact {
  summary: string;
}
```

`companions/build/templates/entity/form.tsx`:

```tsx
import { useState } from "react";
import type { __PASCAL__Input } from "./types";

interface Props {
  onSubmit: (input: __PASCAL__Input) => void | Promise<void>;
}

export default function __PASCAL__Form({ onSubmit }: Props) {
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) { setError("Description is required."); return; }
    setError(null);
    void onSubmit({ description: description.trim() });
  };
  return (
    <form onSubmit={submit} style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6, resize: "vertical" as const }}
        />
      </label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn" type="submit" style={{ alignSelf: "flex-start" }}>Create</button>
    </form>
  );
}
```

`companions/build/templates/entity/pages/List.tsx`:

```tsx
import type { Entity } from "../../../src/shared/types";
import type { __PASCAL__Input, __PASCAL__Artifact } from "../types";

export default function __PASCAL__ListRow({ entity }: { entity: Entity<__PASCAL__Input, __PASCAL__Artifact> }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
      <span style={{ fontWeight: 500 }}>{entity.input.description}</span>
    </div>
  );
}
```

`companions/build/templates/entity/pages/Detail.tsx`:

```tsx
import type { Entity } from "../../../src/shared/types";
import type { __PASCAL__Input, __PASCAL__Artifact } from "../types";

export default function __PASCAL__Detail({ entity }: { entity: Entity<__PASCAL__Input, __PASCAL__Artifact> }) {
  if (!entity.artifact) return null;
  return (
    <div>
      <p style={{ fontSize: 14, margin: 0 }}>{entity.artifact.summary}</p>
    </div>
  );
}
```

`companions/build/templates/entity/index.ts`:

```ts
import type { RegisteredCompanion } from "../../src/server/companion-registry.js";
import { manifest } from "./manifest.js";
import { tools } from "./server/tools.js";

export const __CAMEL__: RegisteredCompanion = { manifest, tools };
```

(`__CAMEL__` stays for the exported binding since it's a variable.)

- [ ] **Step 2.3: Rewrite `companions/build/templates/skill.md`**

Previous template's body was a TODO stub. Replace with a minimal-but-working playbook that runs end-to-end for any entity companion without modification — it echoes the input as the artifact. The scaffolded companion's skill is meant to be a *starting point the user iterates on*; it should still produce a working artifact on first run.

```md
---
name: __NAME__-companion
description: Use when the user pastes "/__NAME__-companion <entity-id>" — runs the __NAME__ companion against one of its pending entities.
---

# /__NAME__-companion <entity-id>

Execute one __NAME__ entity to completion.

> **CRITICAL:** Use the MCP tools (prefixed `mcp__claudepanion__`) for ALL state changes. NEVER curl the REST API or edit JSON files in `data/` directly.

## Step 1 — Load the entity

```
mcp__claudepanion__`__NAME___get`({ id: "<entity-id>" })
```

If the call errors or returns nothing, stop. Do not proceed without the entity loaded.

## Step 2 — Mark running

```
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "running", statusMessage: "starting" })
```

## Step 3 — Do the work

__DESCRIPTION__

As you progress, stream logs via `mcp__claudepanion__`__NAME___append_log``({ id, message }) and update the status message via `mcp__claudepanion__`__NAME___update_status``({ id, status: "running", statusMessage: "<what you're doing>" }).

Use Claude's built-in Read, Grep, Bash, and Edit tools for any file or shell work. Do not invent new MCP tools or call HTTP endpoints.

## Step 4 — Save the artifact

When done, save an artifact matching `__PASCAL__Artifact` in `companions/__NAME__/types.ts`:

```
mcp__claudepanion__`__NAME___save_artifact`({ id: "<entity-id>", artifact: { summary: "<one or two sentences>" } })
```

## Step 5 — Complete

```
mcp__claudepanion__`__NAME___update_status`({ id: "<entity-id>", status: "completed" })
```

On any error at any step:

```
mcp__claudepanion__`__NAME___fail`({ id: "<entity-id>", errorMessage: "<short cause>", errorStack: "<optional stack>" })
```
```

- [ ] **Step 2.4: Rebuild + typecheck**

```bash
npm run check
```

Expected: clean (templates are excluded from tsc via `"exclude": ["companions/build/templates"]`; they don't need to compile — they're source material).

- [ ] **Step 2.5: Commit**

```bash
git add companions/build/templates
git commit -m "templates: PascalCase types + minimal-working skill body

Distinguish __CAMEL__ (variables) from __PASCAL__ (types/components)
so generated code reads idiomatically — \"interface PrReviewerInput\"
instead of \"interface prReviewerInput\".

Scaffolded skill is now a working playbook (status + logs + artifact)
instead of a TODO stub. The user still edits it for their domain,
but the default output runs end-to-end on first submit."
```

---

## Task 3: `skillTemplate` field + propagate `example` through the form (Tier 3A)

**Files:**
- Modify: `companions/build/types.ts` — add `example?: string` to new-companion `BuildInput`.
- Modify: `companions/build/form.tsx` — pass the chip slug through in the submitted payload so `entity.input.example` exists on the entity.
- Modify: `companions/build/examples.ts` — add `skillTemplate` field + author five playbooks.
- Modify: `tests/client/build-examples.test.ts` — cover the optional field.
- Modify: `tests/client/BuildForm.test.tsx` — assert the submitted payload carries `example` when the URL has `?example=...`.

**Goal:** Chip examples carry a domain-specific playbook that Build interpolates into the scaffolded companion's `SKILL.md`, instead of the generic template body. This is what turns "scaffolded PR reviewer that does nothing" into "scaffolded PR reviewer that actually walks a diff."

- [ ] **Step 3.1: Add `example` to BuildInput**

`companions/build/types.ts`, new-companion variant gets an optional `example` slug:

```ts
export type BuildInput =
  | {
      mode: "new-companion";
      name: string;
      kind: "entity" | "tool";
      description: string;
      example?: string;   // slug of the chip that prefilled this — drives skillTemplate lookup
    }
  | {
      mode: "iterate-companion";
      target: string;
      description: string;
    };
```

- [ ] **Step 3.1a: Plumb `example` through the form**

`companions/build/form.tsx` — the `submit` handler for new-companion mode already has access to `exampleSlug` from the URL. Update the submit call so that slug makes it into the submitted input:

```ts
void onSubmit({
  mode,
  name: nm,
  kind,
  description: desc,
  ...(exampleSlug ? { example: exampleSlug } : {}),
});
```

Verify the BuildForm test in `tests/client/BuildForm.test.tsx` covers this. If not, add:

```ts
it("includes example slug in submitted input when URL has ?example=", async () => {
  let submitted: any = null;
  render(
    <MemoryRouter initialEntries={["/c/build/new?example=pr-reviewer"]}>
      <Routes><Route path="*" element={<BuildForm onSubmit={(i) => { submitted = i; }} />} /></Routes>
    </MemoryRouter>
  );
  // pre-fill is covered by existing tests; just submit
  const btn = await screen.findByRole("button", { name: /scaffold companion/i });
  fireEvent.click(btn);
  await waitFor(() => expect(submitted).not.toBeNull());
  expect(submitted.example).toBe("pr-reviewer");
});
```

Run: `npx vitest run tests/client/BuildForm.test.tsx`. Expected: PASS.

- [ ] **Step 3.2: Extend the examples type**

`companions/build/examples.ts`:

```ts
export interface BuildExample {
  slug: string;
  kind: "entity" | "tool";
  displayName: string;
  icon: string;
  description: string;
  /**
   * Optional markdown playbook body that Build uses as the scaffolded
   * companion's skill body (after token substitution). If omitted,
   * Build uses the default template at companions/build/templates/skill.md.
   */
  skillTemplate?: string;
}
```

- [ ] **Step 3.3: Extend the schema test**

`tests/client/build-examples.test.ts`, add:

```ts
it("skillTemplate (if present) is a non-empty string", () => {
  for (const ex of buildExamples) {
    if (ex.skillTemplate !== undefined) {
      expect(typeof ex.skillTemplate).toBe("string");
      expect(ex.skillTemplate.trim().length).toBeGreaterThan(50);
    }
  }
});
```

Run: `npx vitest run tests/client/build-examples.test.ts`. Expected: PASS (skillTemplate is optional; without any entry populating it yet, the test is vacuously true).

- [ ] **Step 3.4: Author the five skillTemplates**

Each is domain-specific. Use `__NAME__`, `__PASCAL__`, and `__DESCRIPTION__` as substitution tokens. Each playbook should specify exact MCP tool calls for load/status/log/artifact/complete, plus the domain-specific steps.

Template for **pr-reviewer** (others follow the same shape; full bodies are inline because the engineer will read all five tasks together):

```ts
{
  slug: "pr-reviewer",
  kind: "entity",
  displayName: "PR reviewer",
  icon: "🔎",
  description: "Review a PR in this repo, flag risky diffs, and suggest questions to ask the author.",
  skillTemplate: `# /__NAME__-companion <entity-id>

Review one pull request and produce a structured review.

> **CRITICAL:** Use the MCP tools (prefixed \`mcp__claudepanion__\`) for ALL state changes. NEVER curl the REST API or edit JSON files in \`data/\` directly.

## Step 1 — Load

\`\`\`
mcp__claudepanion__\`__NAME___get\`({ id: "<entity-id>" })
\`\`\`

Expect \`entity.input.description\` to carry a PR reference (number or branch) and optional focus ("check error paths", "review for perf"). If ambiguous, ask the user for the PR ref before proceeding.

## Step 2 — Fetch the diff

\`\`\`
mcp__claudepanion__\`__NAME___update_status\`({ id, status: "running", statusMessage: "fetching diff" })
\`\`\`

Prefer \`gh pr diff <ref>\` via Bash if the repo uses GitHub and \`gh\` is available. Otherwise use \`git diff <base>..<head>\`. If neither works, \`mcp__claudepanion__\`__NAME___fail\`\` with a clear message.

## Step 3 — Walk changed files

For each file in the diff:

\`\`\`
mcp__claudepanion__\`__NAME___append_log\`({ id, message: "reviewing <path>" })
\`\`\`

Read the file (via Read) alongside the diff hunks. Note: what changed, why it changed (if the commit message says), what's risky (unbounded loops, new deps, security surface, missing tests, unclear naming), what to ask the author.

## Step 4 — Save the review as the artifact

Artifact shape (matches \`__PASCAL__Artifact\` in types.ts — you may want to widen the type first):

\`\`\`
mcp__claudepanion__\`__NAME___save_artifact\`({
  id,
  artifact: {
    summary: "<one-paragraph verdict>",
    filesReviewed: [{ path, risks: [...], questions: [...] }],
    overall: "ship-it" | "comments" | "request-changes"
  }
})
\`\`\`

## Step 5 — Complete

\`\`\`
mcp__claudepanion__\`__NAME___update_status\`({ id, status: "completed" })
\`\`\`

On any step failing:

\`\`\`
mcp__claudepanion__\`__NAME___fail\`({ id, errorMessage: "<short cause>" })
\`\`\`
`
}
```

Write analogous `skillTemplate` bodies for the other four examples:

- **release-notes-drafter** — load → `git log <range>` + `gh pr list --state merged --search 'merged:>=<date>'` → group commits (features / fixes / breaking / internals) → save artifact `{ markdown: "<release notes>" }` → complete.
- **codebase-onboarding-doc** — load → breadth-first repo walk (Read top-level + Grep for entry points) → log progress per major dir → synthesize `{ markdown, startHere, keyConcepts[] }` → save → complete.
- **design-doc-reviewer** — load (expect `description` to include the pasted doc or a path) → walk a checklist (scope clarity / success criteria / risks / unstated assumptions / missing edge cases) → save `{ findings: [{ quote, concern }] }` → complete.
- **postmortem-writer** — load (expect raw incident notes in `description`) → parse timestamps and events → structure into Summary / Impact / Timeline / Root cause / Contributing factors / What went well / Action items → save `{ markdown }` → complete.

Fully specify each — do not leave them as "similar to pr-reviewer" because the plan reader may read tasks out of order.

- [ ] **Step 3.5: Re-run shape test**

```bash
npx vitest run tests/client/build-examples.test.ts
```

Expected: PASS. If the type test now catches missing `skillTemplate` content, fix the offending entries inline.

- [ ] **Step 3.6: Commit**

```bash
git add companions/build/types.ts companions/build/form.tsx companions/build/examples.ts tests/client/build-examples.test.ts tests/client/BuildForm.test.tsx
git commit -m "build: example slug propagates through form + chips carry skillTemplate

BuildInput (new-companion variant) now carries an optional example
slug captured at submit time from the ?example=<slug> URL param.
That slug lands on entity.input.example and Build's skill uses it
to look up the matching BuildExample.skillTemplate — so chip-
originated companions inherit a domain-specific playbook instead of
the generic echo stub.

Each of the 5 chip entries now carries a substantive markdown
playbook."
```

---

## Task 4: Rewrite `skills/build-companion/SKILL.md` (Tier 1)

**Files:**
- Rewrite: `skills/build-companion/SKILL.md`

Apply writing-skills principles: close every loophole explicitly, exact tool-call syntax at every step, no "via your HTTP tool of choice" escape hatches, Common Mistakes section at the bottom naming the specific things that went wrong in the first real run.

- [ ] **Step 4.1: Read the reference**

Open `/home/sean/projects/oncall-investigator/skills/oncall-investigate/SKILL.md` and read it cover to cover. Note the structure: frontmatter → Mode Detection → numbered steps with exact MCP call syntax → embedded warnings in blockquote → Common Mistakes at the bottom. Our rewrite matches this shape.

- [ ] **Step 4.2: Write the new SKILL.md**

Complete replacement. The file goes at `skills/build-companion/SKILL.md`. Writing guidance: use strong assertions ("ALL state changes go through MCP tools. NEVER curl."), show exact syntax at every step, enumerate the loopholes and plug each.

Full content:

```md
---
name: build-companion
description: Use when the user pastes "/build-companion <entity-id>" — scaffolds a new companion or iterates on an existing one for claudepanion.
---

# /build-companion <entity-id>

Claudepanion's built-in companion that scaffolds or iterates on other companions.

> **CRITICAL — MCP tools ONLY:**
> - ALL state changes (status, logs, artifact) go through the tools prefixed \`mcp__claudepanion__\`.
> - NEVER curl the REST API at \`/api/entities/*\` to mutate state.
> - NEVER edit \`data/build/<id>.json\` directly.
> - If an MCP tool returns an error, call \`mcp__claudepanion__build_fail\` with the error. Do NOT fall back to HTTP.
> If MCP tools are unavailable in your session, STOP and tell the user: "MCP tools from claudepanion are not loaded — verify \`claudepanion plugin install\` and that the server is running, then start a new Claude Code session."

> **Server base URL is \`http://localhost:3001\`.** Reliability snapshots at \`/api/reliability/<name>\` are read-only — reading them via Bash curl is allowed as a last resort; writing anything over REST is NOT.

## Step 1 — Load the Build entity

\`\`\`
mcp__claudepanion__build_get({ id: "<entity-id>" })
\`\`\`

Read \`entity.input.mode\`. Branch:
- \`"new-companion"\` → go to "Mode: new-companion" below.
- \`"iterate-companion"\` → go to "Mode: iterate-companion" below.

---

## Mode: new-companion

### Step 2 — Validate + resolve substitution tokens

\`entity.input\` has \`name\`, \`kind\`, \`description\`. Reject if:
- \`name\` doesn't match \`/^[a-z][a-z0-9-]*$/\`.
- \`kind\` is not \`"entity"\` or \`"tool"\`.
- \`companions/<name>/\` already exists on disk.

On reject:

\`\`\`
mcp__claudepanion__build_fail({ id, errorMessage: "<specific reason>" })
\`\`\`

and stop.

Compute substitution tokens. This is mechanical — compute exactly:

| Token | Value from input | Example (\`pr-reviewer\`) |
|---|---|---|
| \`__NAME__\` | the slug | \`pr-reviewer\` |
| \`__CAMEL__\` | camelCase(slug) — strip hyphens and uppercase the following letter | \`prReviewer\` |
| \`__PASCAL__\` | PascalCase — first char of \`__CAMEL__\` uppercased | \`PrReviewer\` |
| \`__DISPLAY__\` | titleized name — split on hyphens, uppercase each word | \`Pr Reviewer\` (the user may edit later — don't get fancy) |
| \`__ICON__\` | pick ONE emoji that fits \`description\` | \`🔎\` |
| \`__DESCRIPTION__\` | \`entity.input.description\` collapsed to one line | "Review a PR in this repo, flag risky diffs…" |

### Step 3 — Mark running

\`\`\`
mcp__claudepanion__build_update_status({ id, status: "running", statusMessage: "scaffolding files" })
\`\`\`

### Step 4 — Scaffold files from templates

For \`kind: "entity"\`, write these files. Read the template from the indicated path, substitute tokens, Write the result to the target path.

| Template | Target |
|---|---|
| \`companions/build/templates/entity/manifest.ts\` | \`companions/__NAME__/manifest.ts\` |
| \`companions/build/templates/entity/types.ts\` | \`companions/__NAME__/types.ts\` |
| \`companions/build/templates/entity/index.ts\` | \`companions/__NAME__/index.ts\` |
| \`companions/build/templates/entity/form.tsx\` | \`companions/__NAME__/form.tsx\` |
| \`companions/build/templates/entity/pages/List.tsx\` | \`companions/__NAME__/pages/List.tsx\` |
| \`companions/build/templates/entity/pages/Detail.tsx\` | \`companions/__NAME__/pages/Detail.tsx\` |
| \`companions/build/templates/entity/server/tools.ts\` | \`companions/__NAME__/server/tools.ts\` |

For the skill file, check \`entity.input.example\` if present (it won't be for hand-written runs; it IS set when the user clicked a chip). Load \`companions/build/examples.ts\` and find the example where \`slug === entity.input.example\`. If found AND the example has a \`skillTemplate\`, substitute tokens into that body and write it to \`skills/__NAME__-companion/SKILL.md\`. Otherwise fall back to \`companions/build/templates/skill.md\`.

After each file Write:

\`\`\`
mcp__claudepanion__build_append_log({ id, message: "wrote <path>" })
\`\`\`

For \`kind: "tool"\`, use \`companions/build/templates/tool/\` — only \`manifest.ts\`, \`index.ts\`, \`server/tools.ts\`, and the skill file.

### Step 5 — Register the companion

Edit \`companions/index.ts\`. Read it first. The file has shape:

\`\`\`ts
import type { RegisteredCompanion } from "../src/server/companion-registry.js";
import { build } from "./build/index.js";
// ...existing imports (alphabetical by slug)

export const companions: RegisteredCompanion[] = [build /*, ...alphabetical */];
\`\`\`

Add a new import line for the new companion in alphabetical slug order (the CAMEL name is the exported binding from the companion's \`index.ts\`):

\`\`\`ts
import { __CAMEL__ } from "./__NAME__/index.js";
\`\`\`

Add \`__CAMEL__\` to the \`companions\` array, preserving alphabetical order.

Then edit \`companions/client.ts\` (this is the step that produced the "No form registered" error when it was previously skipped). The file has shape:

\`\`\`ts
import type { Entity } from "../src/shared/types";
import type { ComponentType } from "react";
import BuildDetail from "./build/pages/Detail";
import BuildListRow from "./build/pages/List";
import BuildForm from "./build/form";
// ...other existing imports, alphabetical by slug

type ArtifactRenderer = ComponentType<{ entity: Entity }>;
type ListRow = ComponentType<{ entity: Entity }>;
type CompanionForm = ComponentType<{ onSubmit: (input: unknown) => void | Promise<void> }>;

const artifactRenderers: Record<string, ArtifactRenderer> = {
  "build": BuildDetail as ArtifactRenderer,
  // ...
};
const listRows: Record<string, ListRow> = {
  "build": BuildListRow as ListRow,
  // ...
};
const forms: Record<string, CompanionForm> = {
  "build": BuildForm as CompanionForm,
  // ...
};

export function getArtifactRenderer(name: string): ArtifactRenderer | undefined { return artifactRenderers[name]; }
export function getListRow(name: string): ListRow | undefined { return listRows[name]; }
export function getForm(name: string): CompanionForm | undefined { return forms[name]; }
\`\`\`

Add three imports and three registry entries for entity kind:

\`\`\`ts
import __PASCAL__Detail from "./__NAME__/pages/Detail";
import __PASCAL__ListRow from "./__NAME__/pages/List";
import __PASCAL__Form from "./__NAME__/form";

// ...in artifactRenderers:
  "__NAME__": __PASCAL__Detail as ArtifactRenderer,
// ...in listRows:
  "__NAME__": __PASCAL__ListRow as ListRow,
// ...in forms:
  "__NAME__": __PASCAL__Form as CompanionForm,
\`\`\`

For \`kind: "tool"\`, skip \`companions/client.ts\` entirely — tool companions don't register forms/lists/details.

Log:

\`\`\`
mcp__claudepanion__build_append_log({ id, message: "registered __NAME__ in companions/index.ts and companions/client.ts" })
\`\`\`

### Step 6 — Wait for the watcher + read the reliability snapshot

\`\`\`
mcp__claudepanion__build_update_status({ id, status: "running", statusMessage: "validating" })
\`\`\`

Wait 2 seconds for the watcher's debounce + re-mount. Then check the reliability snapshot. GET is read-only so bash curl is acceptable:

\`\`\`bash
curl -s http://localhost:3001/api/reliability/__NAME__
\`\`\`

Parse \`validator.ok\` and \`smoke.ok\`. Log:

\`\`\`
mcp__claudepanion__build_append_log({ id, message: "validator=<bool>, smoke=<bool>" })
\`\`\`

### Step 7 — Commit

\`\`\`bash
git add companions/__NAME__ skills/__NAME__-companion companions/index.ts companions/client.ts
git commit -m "companion: scaffold __NAME__"
\`\`\`

If tool kind, omit \`companions/client.ts\` from \`git add\`.

### Step 8 — Save artifact + complete

\`\`\`
mcp__claudepanion__build_save_artifact({
  id,
  artifact: {
    filesCreated: [<list of new file paths>],
    filesModified: ["companions/index.ts", "companions/client.ts"],
    summary: "Scaffolded __NAME__ (__KIND__).",
    validatorPassed: <bool>,
    smokeTestPassed: <bool>
  }
})

mcp__claudepanion__build_update_status({ id, status: "completed" })
\`\`\`

If validator failed fatally:

\`\`\`
mcp__claudepanion__build_fail({ id, errorMessage: "validator: <issues>" })
\`\`\`

---

## Mode: iterate-companion

### Step 2 — Load target

\`entity.input\` has \`target\` (slug) and \`description\` (what to change). Verify:
- \`companions/<target>/\` exists.
- \`target !== "build"\` (reject self-iteration — \`mcp__claudepanion__build_fail({ id, errorMessage: "cannot iterate on Build itself" })\`).

### Step 3 — Mark running

\`\`\`
mcp__claudepanion__build_update_status({ id, status: "running", statusMessage: "reading current source" })
\`\`\`

### Step 4 — Read current source

Read every file under \`companions/<target>/\`. Note the manifest version.

### Step 5 — Apply the change

\`\`\`
mcp__claudepanion__build_update_status({ id, status: "running", statusMessage: "applying change" })
\`\`\`

Judgment step. Read \`entity.input.description\` and make the requested modifications using Edit. Keep changes focused. After each file:

\`\`\`
mcp__claudepanion__build_append_log({ id, message: "modified <path>" })
\`\`\`

### Step 6 — Bump version

Update \`companions/<target>/manifest.ts\` \`version\` field:
- Patch (0.1.0 → 0.1.1) for language like "fix", "typo", "wording".
- Major (0.1.0 → 1.0.0) for explicit "breaking".
- Minor (0.1.0 → 0.2.0) otherwise.

### Step 7 — Validate via reliability snapshot

Same as new-companion Step 6, but for \`<target>\`.

### Step 8 — Commit

\`\`\`bash
git add companions/<target>
git commit -m "companion(<target>): <one-line summary>"
\`\`\`

### Step 9 — Save artifact + complete

\`\`\`
mcp__claudepanion__build_save_artifact({
  id,
  artifact: {
    filesCreated: [],
    filesModified: [<list>],
    summary: "<what changed and why>",
    validatorPassed: <bool>,
    smokeTestPassed: <bool>
  }
})

mcp__claudepanion__build_update_status({ id, status: "completed" })
\`\`\`

---

## Common mistakes

Each of these caused a real failure in an earlier run. Don't repeat them.

| Mistake | Fix |
|---|---|
| "Let me curl the MCP endpoint since the tools aren't loaded." | STOP. Tell the user MCP tools aren't loaded. Do not fall back to HTTP. |
| "I'll PATCH /api/entities/<id> to update status." | The REST API does not have PATCH endpoints and should not be used for mutations regardless. Use \`mcp__claudepanion__<companion>_update_status\`. |
| "I'll write directly to data/<companion>/<id>.json via a Node script." | Never. State changes go through MCP tools. Direct file writes bypass logging, watchers, and session context. |
| Skipping \`companions/client.ts\` registration. | The new companion's form/list/detail registry lives in \`client.ts\`. Miss it and the UI shows "No form registered." Always edit BOTH \`index.ts\` and \`client.ts\`. |
| Writing \`interface __CAMEL__Input\` instead of \`interface __PASCAL__Input\`. | Type and component names are PascalCase. Variable names are camelCase. Check \`__PASCAL__\` was computed and substituted. |
| Generic skill stub left in place when a chip example was clicked. | Check \`entity.input.example\`. If set, look up \`companions/build/examples.ts\`, use that example's \`skillTemplate\` instead of the default template. |
| Committing without \`git add companions/<name>\`. | \`git add\` must include the new companion directory AND the registration files AND the skill directory. Miss any and next session's diff is confusing. |

## Red flags — STOP and re-read this skill

- About to write a curl command against \`/api/entities\`.
- About to invent an MCP tool name not listed here.
- About to edit \`data/**/*.json\` directly.
- About to skip \`companions/client.ts\` "because the UI will figure it out."
- About to substitute \`__CAMEL__\` where a type is declared.

All of these mean: stop, re-read the skill, try again the correct way.
```

- [ ] **Step 4.3: Commit**

```bash
git add skills/build-companion/SKILL.md
git commit -m "skill: rewrite build-companion — MCP-only + exact syntax + loopholes closed

Matches oncall-investigator's prescriptiveness. Strict \"MCP tools
only\" guardrail with multiple warnings + a red-flags list at the
bottom. Every step shows exact tool-call syntax with the
mcp__claudepanion__ prefix. Step 5 (registration) spells out the
exact contents of both companions/index.ts AND companions/client.ts
— the \"No form registered\" symptom came from skipping client.ts.
Step 4 (scaffold files) explicitly reads entity.input.example and
uses the chip's skillTemplate when present, so a chip-originated
companion inherits a domain-specific playbook rather than the
generic echo stub.

Common Mistakes section names every failure seen in the first real
scaffold run as a STOP signal."
```

---

## Task 5: End-to-end smoke

**Files:** none; manual verification.

This is our GREEN test for the skill rewrite — we run a real Build cycle and verify it succeeds on first try.

- [ ] **Step 5.1: Rebuild + full CI gates**

```bash
kill $(lsof -t -i :3001) 2>/dev/null; sleep 1
npm run lint && npm run check && npm test && npm run build
```

Expected: all four gates green. 98 tests (was 95; we added 1 test in Task 3, and the Task 4 skill rewrite doesn't add tests).

- [ ] **Step 5.2: Fresh install path**

Pick a scratch target repo on your machine (e.g., `mktemp -d` + `git init`). In that repo:

```bash
# Wipe any previous claudepanion wiring
rm -f .claude/settings.local.json

# Fresh plugin install
claudepanion plugin install

# Verify settings.local.json — should NOT contain disabledMcpjsonServers
cat .claude/settings.local.json
```

Expected contents (exactly):

```json
{
  "enabledPlugins": {
    "claudepanion@local": true
  },
  "extraKnownMarketplaces": {
    "local": {
      "source": {
        "source": "directory",
        "path": "/home/sean/projects/claude-manager"
      }
    }
  }
}
```

- [ ] **Step 5.3: Start the server in a separate terminal**

```bash
rm -f data/build/*.json   # clean first-run state
claudepanion serve
```

- [ ] **Step 5.4: Start a fresh Claude Code session**

In the scratch target repo, start a NEW Claude Code session.

Verify:
- `/plugin` — `claudepanion@local` should be listed as loaded (not "needs attention").
- `/mcp` — `claudepanion` should show connected.
- Ask: "what MCP tools do you have from claudepanion?" — should list `build_get`, `build_list`, `build_update_status`, `build_append_log`, `build_save_artifact`, `build_fail`.

If any of these fail, stop and return to Task 1.

- [ ] **Step 5.5: Scaffold a companion via the UI**

Open <http://localhost:3001/c/build>. Click the 🔎 PR reviewer chip. Submit the form (accepting prefill).

- [ ] **Step 5.6: Run the slash command in Claude Code**

Paste the generated `/build-companion build-<hex>` slash command into the session from Step 5.4. Claude should:

1. Call `mcp__claudepanion__build_get` (no curl).
2. Call `mcp__claudepanion__build_update_status` for "scaffolding files".
3. Read templates, write files for `companions/pr-reviewer/`, write skill file using the pr-reviewer example's `skillTemplate` (NOT the generic template).
4. Edit `companions/index.ts` AND `companions/client.ts`.
5. Wait, curl `/api/reliability/pr-reviewer` (read-only — allowed).
6. Commit.
7. Save artifact, mark completed.

- [ ] **Step 5.7: Verify scaffolded companion is live**

Refresh <http://localhost:3001/> — PR reviewer should appear in the sidebar under COMPANIONS.

Click it. Click **+ New**. Form should render (NOT "No form registered"). Fill in a description. Submit. Detail page should render a slash command `/pr-reviewer-companion <id>`.

Run that slash command in Claude Code. Claude should now follow the pr-reviewer domain playbook (fetch the diff, walk files, save a structured artifact) — NOT the generic echo stub.

- [ ] **Step 5.8: Cleanup + commit the plan completion note**

```bash
# Back in the claudepanion repo
rm -rf companions/pr-reviewer skills/pr-reviewer-companion
# Revert companions/index.ts and companions/client.ts to head
git checkout HEAD -- companions/index.ts companions/client.ts
```

(We don't want the smoke-test scaffold to pollute the PR.)

No final commit needed for Task 5 if the scaffold artifacts weren't intended to ship. If you want to ship the pr-reviewer companion for real, that's a separate follow-up: keep the files, add an entry to `docs/followups.md` or commit them as a distinct change.
