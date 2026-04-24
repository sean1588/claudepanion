---
name: __NAME__-companion
description: Invoked with `/__NAME__-companion <entity-id>`. Loads the entity, runs the __NAME__ domain work, streams progress, and writes an artifact.
---

# /__NAME__-companion <entity-id>

Playbook for running a __NAME__ entity to completion. Replace the TODOs with domain-specific logic.

## Step 1 — Load

Call `__NAME___get(id)` to fetch `entity`. If not found, stop.

## Step 2 — Mark running

Call `__NAME___update_status(id, "running", "starting…")`.

## Step 3 — Do the work

TODO: implement __DESCRIPTION__ using `entity.input`. Stream progress with
`__NAME___append_log(id, message)` and `__NAME___update_status(id, "running", "<current step>")`.

## Step 4 — Save artifact

Once complete, call `__NAME___save_artifact(id, { ... })` with the shape of `__CAMEL__Artifact`
from `companions/__NAME__/types.ts`.

## Step 5 — Finalize

`__NAME___update_status(id, "completed")` on success.
On failure: `__NAME___fail(id, errorMessage, errorStack?)`.
