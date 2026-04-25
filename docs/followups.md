# Followups

A single place to keep known-gaps and deferred ideas so they don't get forgotten between sessions. Each item should be small enough that it could become its own focused change; bigger ones get their own plan doc in `docs/superpowers/plans/`.

## Companion deletion

No way for a user to delete a companion today. Manually requires deleting the companion directory, removing the import from `companions/index.ts`, removing 3 entries from `companions/client.ts`, deleting `skills/<name>-companion/`, and restarting the server. The watcher handles remount but the file cleanup is tedious and easy to get wrong.

Since Build will generate companions users want to throw away, this needs a solution. Options to evaluate:

- **CLI**: `claudepanion companion delete <slug>` — deletes files + cleans registrations atomically.
- **UI button**: "🗑 Delete companion" on each companion's list/About page header. Could call a `DELETE /api/companions/:slug` endpoint that the server handles (delete files, regenerate index.ts, remount).
- **Iterate-with-Build path**: ask Build to remove the companion (reads the files, undoes the registrations, commits the removal).

The CLI option is the simplest to implement and least likely to have unintended side effects.

---

## Onboarding / first-run UX

When Plans 1–7 landed we stripped the pre-installed example companions (Expense Tracker, Homelab) because they were verification fixtures, not demos — Homelab was a mock that actively misled users. A default install is now just Build + Install. That's honest but bare.

Design questions for a dedicated onboarding pass:

- **Prefilled Build textarea**: seed the "What should this companion do?" field with a placeholder like "Track books I'm reading and have Claude summarize them." Cheap signal that you can just type what you want.
- **"Surprise me" button** next to the Build form's Create button. Picks from a curated list of prompt ideas (GitHub PR reviewer, reading tracker, expense tagger, oncall triage, Linear triage, release-notes drafter…) and populates the textarea. Maybe shows the slug + kind it would create. Not a submit — just population.
- **Empty-state guidance on the Build list page** when no Build runs exist yet: 2–3 example prompts as clickable chips.
- **Curated example prompts file** — ship `companions/build/example-prompts.json` or similar so the Surprise-me button has a list to draw from. Users can edit it.
- **Should we still ship a working tool-kind example?** Homelab was a mock; a real one (weather, calendar, GitHub status) would be a live demo of `defineTool`. Open question: is this worth the maintenance surface, or do templates + Build teach the pattern well enough?

Not a shipping-blocker; revisit after the initial implementation settles.

## Known gaps from the vision-alignment audit

Each of these is a named gap from comparing the shipped state to `docs/concept.md` (the Notion vision doc).

1. **No real external-proxy companion.** Vision element #10 (proxy tools for AWS / GitHub / etc.) is architecturally supported but has no shipping example. Ship one (oncall-investigator style or a PR reviewer) to demonstrate the pattern.

2. **Cross-companion composition unaddressed.** Vision open question #5 — a companion can't call another companion's MCP tools today. Needs: explicit `consumes` declarations in manifest, versioning story for cross-companion tool contracts, review gate. Deferred but worth a design pass.

3. **`/install-companion` as a slash command skill.** Today `/install` is a UI page only. Claude in Claude Code can't install a companion without the user opening the browser. Adding the skill parallels the vision's "third-party companions installed via slash command" story.

4. **Contract is almost but not quite exports-shaped.** Validator enforces file paths (`form.tsx`, `pages/List.tsx`, `server/tools.ts`) for local companions. The vision called for "contract as exports, not filesystem layout." Lives in the local-authoring story; npm-installed companions don't hit this rule. Either relax the local rule to match, or document the asymmetry.

5. **Smoke runs tool callability, not headless render.** Vision's Build reliability section #3 wanted "load the companion and render its pages headlessly." Spec pivoted to tool-smoke; both defensible. If rendering-smoke lands later it becomes a separate check alongside the current one.

## Handoff UX — making the Claude Code step feel like summoning a companion

The slash command handoff (form → pending state → paste into Claude Code) is load-bearing and intentional — it's the moment the user delegates to Claude with permission and context. But it currently reads like a technical instruction rather than an invitation. The framing should match the name: you're calling on a companion, not running a job.

**Why the handoff is the right model (don't remove it):**
- It's the permission grant — the user chooses when and where Claude operates.
- Interactive mid-run — Claude can ask clarifying questions; headless API calls can't.
- Local tool access — Read/Write/Bash/Edit only exist in a Claude Code session.
- The name "claudepanion" only makes sense if Claude is present. A background process isn't a companion.

**Improvements to the pending state:**
- Replace generic copy with a one-line summary of what Claude is about to do based on the form input. e.g. *"Claude will review PR #142 in myorg/myrepo, read the diff, and post a structured review."*
- Add a short "what to expect" note: *"Claude will update this page as it works. Follow along here or interact with it in your terminal."*
- Frame the slash command as an invitation, not a command: *"Your companion is ready. Open Claude Code in this repo and paste:"*

**During the run:**
- The live log tail is Claude narrating its work in real time — lean into that. "Claude is working…" not "running…".
- Log messages from `_append_log` calls should read like a collaborator giving updates, not a system printing status codes.

**The Continue flow:**
- "Continue with Claude" after completion is a natural re-engagement point that already exists. Make it feel like picking the conversation back up, not re-submitting a form.

**Future consideration — pure-proxy headless mode:**
- A companion that only calls external API proxy tools (no Read/Write/Bash/Edit) could theoretically run headlessly via the Anthropic API without a Claude Code session. Worth exploring for a specific class of companions, but introduces a two-tier capability model. Don't pursue until there's a concrete use case that can't be served by the current flow.

---

## Smaller polish items

- Pulsing indicator on the running status pill.
- Artifact header can declare actions (Copy JSON, Export CSV) — currently no hook for that.
- Logs panel should collapse on the completed state (currently always expanded except on pending).
- `/` lands on `/c/build` always. Track last-visited companion (localStorage) and route there instead on return visits.
- Sidebar enforces alphabetical-by-slug within the entity + tool sections. Today it's array-order.
- Two-CTA form: the Build list page now has "⟳ Iterate on existing" and "+ New companion" buttons; they both route to the same form which presets mode from the querystring. That works but could feel tighter if the two routes actually landed on different form variants.

## Dev-mode ergonomics

- `npm run dev` doesn't run `tsc --watch`, so the watcher in Plan 2 never sees rebuilt companion code in dev. Watcher works great against production builds (`npm start`) but dev iteration requires a manual rebuild. Adding `tsc --watch` to the concurrently script is probably all it takes.
