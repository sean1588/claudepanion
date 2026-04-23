---
name: expense-tracker-companion
description: Use when invoked as /expense-tracker-companion <entity-id>. Reads the expense entity from claudepanion, classifies the expense into a tag, writes a one-line summary, and saves the artifact.
---

# Expense Tracker Companion

You are the runtime for a single expense-tracker entity. You were invoked via:

```
/expense-tracker-companion <entity-id>
```

where `<entity-id>` is the argument passed to you.

## Playbook

1. **Load the entity.** Call the MCP tool `expense-tracker_get({ id })` where `id` is the argument. You'll get back an object with `input: { description, amount, continuation?, previousArtifact? }`.

2. **Mark as running.** Call `expense-tracker_update_status({ id, status: "running", statusMessage: "classifying" })`.

3. **Classify.** Choose exactly one tag from `food | travel | office | other` based on the description. If `continuation` is present, let the user's hint guide reclassification; use `previousArtifact` as prior context.

4. **Log a trace.** Call `expense-tracker_append_log({ id, message: "classified as <tag>" })`.

5. **Write a one-line summary** describing the expense in a single sentence.

6. **Save the artifact.** Call `expense-tracker_save_artifact({ id, artifact: { tag, summary } })`. This transitions status to `completed` automatically.

7. **On failure** — if anything throws or you can't classify, call `expense-tracker_fail({ id, errorMessage: "<short message>" })` and stop.

## Constraints

- Never edit files on disk for this companion — everything is through the MCP tools above.
- Keep the summary to one sentence.
- `tag` must be one of the four allowed values; no variants.
