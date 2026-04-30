---
name: github-pr-reviewer-companion
description: Use when the user pastes "/github-pr-reviewer-companion <entity-id>" — reviews a GitHub PR by fetching metadata, diff, and review comments; flags risky patterns; suggests review questions. Read-only.
companion: github-pr-reviewer
triggers:
  - /github-pr-reviewer-companion
---

# /github-pr-reviewer-companion <entity-id>

Review a GitHub pull request using authenticated proxy access. Fetches PR metadata, the unified diff, and existing review comments; flags risky diffs (auth changes, swallowed errors, missing tests); suggests review questions for the author. Read-only — nothing is posted back to GitHub.

> **CRITICAL — MCP tools ONLY:**
> - ALL state changes go through `mcp__claudepanion__github_pr_reviewer_*` and `mcp__claudepanion__build_*` tools.
> - NEVER curl the REST API at `/api/entities/*` to mutate state.
> - If an MCP tool returns an error, call `mcp__claudepanion__github_pr_reviewer_fail` and stop.

## Step 1 — Load the entity

```
mcp__claudepanion__github_pr_reviewer_get({ id: "<entity-id>" })
```

Read `entity.input`: `{ repo, prNumber, focus? }`. Confirm `GITHUB_TOKEN` is set (the manifest declares it as `requiredEnv` — the preflight blocks submission if it's missing, so you can proceed).

```
mcp__claudepanion__github_pr_reviewer_update_status({ id, status: "running", statusMessage: "fetching PR data" })
mcp__claudepanion__github_pr_reviewer_append_log({ id, message: "Starting review of " + repo + "#" + prNumber })
```

## Step 2 — Fetch PR metadata

### 2a — Get PR details and file list

```
mcp__claudepanion__github_pr_reviewer_get_pr({ repo: <from input>, prNumber: <from input> })
```

Log the result:

```
mcp__claudepanion__github_pr_reviewer_append_log({ id, message: "Fetched PR: <title> by <author> — <filesChanged> files, +<additions>/-<deletions>" })
```

Note: `prTitle`, `prUrl`, `prAuthor`, `filesChanged`, `additions`, `deletions`, `labels`, `baseBranch`, `headBranch`, and the per-file `files[]` array (with patches) are all in this response.

## Step 3 — Fetch the unified diff

### 3a — Get the full diff

```
mcp__claudepanion__github_pr_reviewer_get_diff({ repo: <from input>, prNumber: <from input> })
```

```
mcp__claudepanion__github_pr_reviewer_append_log({ id, message: "Fetched unified diff" })
```

## Step 4 — Fetch existing review comments

### 4a — Get reviews, review comments, and issue comments

```
mcp__claudepanion__github_pr_reviewer_get_comments({ repo: <from input>, prNumber: <from input> })
```

```
mcp__claudepanion__github_pr_reviewer_append_log({ id, message: "Fetched existing comments: <N> review comments, <M> reviews" })
```

## Step 5 — Analyze and produce the artifact

With the PR metadata, diff, and existing comments in hand, analyze for:

**Risks to flag** (check all of these):
- Auth/permission changes (middleware, token validation, role checks, OAuth flows)
- Swallowed errors (`catch {}`, `catch (e) { /* ignored */ }`, silent fallbacks)
- Missing or removed tests for changed code paths
- Hard-coded secrets, credentials, or API keys in diffs
- Unsafe deserialization or SQL/command injection surfaces
- Race conditions in async code (missing `await`, shared mutable state)
- Breaking API contract changes (removed fields, changed types in public interfaces)
- If `focus` was provided, prioritize risks in that area

**Review questions to suggest** — concrete, specific questions the reviewer should ask the PR author. Ground each question in a specific hunk or file, not generic advice.

```
mcp__claudepanion__github_pr_reviewer_append_log({ id, message: "Analysis complete — <N> risks, <M> questions" })
```

## Step 6 — Save the artifact

```
mcp__claudepanion__github_pr_reviewer_save_artifact({
  id,
  artifact: {
    prTitle: "<from Step 2>",
    prUrl: "<from Step 2>",
    prAuthor: "<from Step 2>",
    filesChanged: <from Step 2>,
    risks: ["<risk 1>", "<risk 2>", ...],
    reviewQuestions: ["<question 1>", "<question 2>", ...],
    summary: "<one sentence: e.g. '3 risks flagged in auth middleware and async handlers'>",
  }
})
mcp__claudepanion__github_pr_reviewer_update_status({ id, status: "completed" })
```

## Error handling

If any proxy tool returns `isError: true`:

- `[config]` errors → token is missing or invalid. Call `mcp__claudepanion__github_pr_reviewer_fail` with the message and stop.
- `[input]` errors → bad repo/PR number. Call `mcp__claudepanion__github_pr_reviewer_fail` with the message and stop.
- `[transient]` errors → GitHub API flake. Retry once, then call `mcp__claudepanion__github_pr_reviewer_fail`.
