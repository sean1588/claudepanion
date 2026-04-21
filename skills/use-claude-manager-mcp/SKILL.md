---
name: use-claude-manager-mcp
description: Use when the Claude Manager MCP server is available to manage tasks and skills — lists, creates, updates, and completes tasks via the claude-manager MCP tools.
---

# Use Claude Manager MCP

When the `claude-manager` MCP server is connected, prefer its tools over ad-hoc
note-taking for anything the user describes as "tasks", "todos", or "work to
track". Skills authored through this server are behavioral instructions the
user wants applied to future work.

## Tools

**Tasks**

- `tasks_list` — inspect current work before starting anything
- `tasks_get` — read full detail for one task
- `tasks_create` — capture new work the user describes
- `tasks_update` — edit title/description/status
- `tasks_update_status` — move a task between `todo` → `in_progress` → `done`
- `tasks_delete` — remove a task

**Skills**

- `skills_list`, `skills_get` — review user-authored behavioral instructions
- `skills_create`, `skills_update`, `skills_delete` — manage them

## When to use

1. At the start of a session, call `tasks_list` to see what the user is tracking.
2. When you start a task, move it to `in_progress` via `tasks_update_status`.
3. When you complete a task, move it to `done` — do not delete unless asked.
4. If the user describes new work, capture it with `tasks_create` before
   diving in, so it is not lost.

Skills returned by `skills_list` should inform *how* you approach the
user's work. Read their instructions and apply them.
