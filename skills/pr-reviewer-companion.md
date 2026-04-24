---
name: pr-reviewer-companion
description: Invoked with `/pr-reviewer-companion <entity-id>`. Loads the entity, runs the pr-reviewer domain work, streams progress, and writes an artifact.
---

# /pr-reviewer-companion <entity-id>

Playbook for running a pr-reviewer entity to completion. Replace the TODOs with domain-specific logic.

## Step 1 — Load

Call `pr-reviewer_get(id)` to fetch `entity`. If not found, stop.

## Step 2 — Mark running

Call `pr-reviewer_update_status(id, "running", "starting…")`.

## Step 3 — Do the work

TODO: implement Review a PR in this repo, flag risky diffs, and suggest questions to ask the author. using `entity.input`. Stream progress with
`pr-reviewer_append_log(id, message)` and `pr-reviewer_update_status(id, "running", "<current step>")`.

## Step 4 — Save artifact

Once complete, call `pr-reviewer_save_artifact(id, { ... })` with the shape of `prReviewerArtifact`
from `companions/pr-reviewer/types.ts`.

## Step 5 — Finalize

`pr-reviewer_update_status(id, "completed")` on success.
On failure: `pr-reviewer_fail(id, errorMessage, errorStack?)`
