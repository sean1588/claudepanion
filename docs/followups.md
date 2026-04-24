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

## Smaller polish items

- Pulsing indicator on the running status pill.
- Artifact header can declare actions (Copy JSON, Export CSV) — currently no hook for that.
- Logs panel should collapse on the completed state (currently always expanded except on pending).
- `/` lands on `/c/build` always. Track last-visited companion (localStorage) and route there instead on return visits.
- Sidebar enforces alphabetical-by-slug within the entity + tool sections. Today it's array-order.
- Two-CTA form: the Build list page now has "⟳ Iterate on existing" and "+ New companion" buttons; they both route to the same form which presets mode from the querystring. That works but could feel tighter if the two routes actually landed on different form variants.

## Dev-mode ergonomics

- `npm run dev` doesn't run `tsc --watch`, so the watcher in Plan 2 never sees rebuilt companion code in dev. Watcher works great against production builds (`npm start`) but dev iteration requires a manual rebuild. Adding `tsc --watch` to the concurrently script is probably all it takes.
