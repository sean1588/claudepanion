/**
 * Public API for companions.
 *
 * Companions in ~/.claudepanion/companions/<slug>/ import from this module via
 * the `claudepanion-host` symlink that `claudepanion init` creates in
 * ~/.claudepanion/node_modules/.
 *
 * Adding to this surface is a public API change — bump the contractVersion in
 * companions/build/manifest.ts if you break or rename something.
 */

export { defineTool } from "../shared/define-tool.js";
export {
  successResult,
  configErrorResult,
} from "../shared/types.js";
export type {
  BaseArtifact,
  Entity,
  EntityStatus,
  Manifest,
  CompanionKind,
  CompanionToolDefinition,
  LogEntry,
} from "../shared/types.js";
