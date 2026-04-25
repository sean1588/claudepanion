import { z } from "zod";
import type { CompanionToolDefinition } from "../../../src/shared/types.js";
import { successResult, errorResult } from "../../../src/shared/types.js";

// Domain proxy tools for __NAME__.
//
// Each tool calls an external API using locally-stored credentials.
// The host auto-registers the six generic entity tools (_get, _list,
// _update_status, _append_log, _save_artifact, _fail) — don't add them here.
//
// Every tool name must be prefixed "__NAME___".

export const tools: CompanionToolDefinition[] = [
  // Replace this example with your actual external API calls:
  //
  // {
  //   name: "__NAME___fetch",
  //   description:
  //     "Fetch data from the external service. Called by the skill during Step 3a.",
  //   schema: {
  //     id: z.string().describe("entity ID"),
  //     query: z.string().describe("query to send to the external API"),
  //   },
  //   async handler({ id, query }: { id: string; query: string }) {
  //     // Call your external API here with locally-stored credentials.
  //     // e.g. AWS SDK, GitHub API client, Linear SDK, etc.
  //     // return successResult(data)  on success
  //     // return errorResult(message) on failure — lets the skill call _fail
  //     return errorResult("not implemented — replace with a real API call");
  //   },
  // },
];
