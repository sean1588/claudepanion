import type { ToolHandler } from "../../../src/server/companion-registry.js";

// Domain tools for pr-reviewer go here. They must be namespaced "pr-reviewer_<verb>".
// Generic entity tools (_get, _list, _update_status, _append_log, _save_artifact, _fail)
// are auto-registered by the host.
export const tools: Record<string, ToolHandler> = {};
