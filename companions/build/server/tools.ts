import type { CompanionToolDefinition } from "claudepanion-host";

// Build companion has no proxy tools — the host's auto-generated entity tools
// (_get, _update_status, _append_log, _save_artifact, _fail) are what the build
// skill calls.
export const tools: CompanionToolDefinition[] = [];
