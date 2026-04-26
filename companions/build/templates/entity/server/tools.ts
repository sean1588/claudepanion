import type { CompanionToolDefinition } from "../../../src/shared/types.js";

// TODO(build): author one CompanionToolDefinition per external API call per
// scaffold-spec §16d (server/tools.ts). Each tool follows §9d:
// validate config → validate input → call API → classify error → return.
//
// - Tool names must be prefixed "__NAME___" (slug hyphens become underscores).
// - Pick the SDK from §16c (e.g. @octokit/rest for GitHub) and add it to the
//   host's root package.json before npm install.
// - Set sideEffect: "write" on tools that change external state — the skill
//   will require user permission before each call (§9e).
// - Validate config with configErrorResult; classify errors with
//   transientErrorResult / inputErrorResult / errorResult.
//
// EMPTY ARRAY IS A BUILD FAILURE WHEN THE DESCRIPTION NAMES AN EXTERNAL SYSTEM
// (§16f.1). Build's Step 6.5 self-check verifies this before commit.

export const tools: CompanionToolDefinition[] = [];
