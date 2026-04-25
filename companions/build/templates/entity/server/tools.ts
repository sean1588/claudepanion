import { z } from "zod";
import type { CompanionToolDefinition } from "../../../src/shared/types.js";
import { successResult, errorResult, configErrorResult, transientErrorResult } from "../../../src/shared/types.js";

// Domain proxy tools for __NAME__.
//
// Each tool calls an external API using locally-stored credentials.
// The host auto-registers the six generic entity tools (_get, _list,
// _update_status, _append_log, _save_artifact, _fail) — don't add them here.
//
// Every tool name must be prefixed "__NAME___".
// Set sideEffect: "write" on tools that change external state — the skill
// will require user permission before each call.

export const tools: CompanionToolDefinition[] = [
  // Read-only example (sideEffect defaults to "read"):
  //
  // {
  //   name: "__NAME___fetch",
  //   description: "Fetch data from the external service.",
  //   schema: {
  //     id: z.string().describe("entity ID"),
  //     query: z.string().describe("query to send to the external API"),
  //   },
  //   async handler({ id, query }: { id: string; query: string }) {
  //     const token = process.env.SERVICE_TOKEN;
  //     if (!token) return configErrorResult("SERVICE_TOKEN", "create a token at example.com/tokens");
  //     try {
  //       const data = await fetch("https://api.example.com/...").then((r) => r.json());
  //       return successResult(data);
  //     } catch (err: any) {
  //       if (err.code === "ECONNREFUSED") return transientErrorResult(`network error: ${err.message}`);
  //       return errorResult(`API error: ${err.message}`);
  //     }
  //   },
  // },
  //
  // Write example (sideEffect: "write" — skill prompts for permission):
  //
  // {
  //   name: "__NAME___create",
  //   description: "Create a new resource. Visible to other users; cannot be deleted.",
  //   schema: { id: z.string(), title: z.string() },
  //   sideEffect: "write",
  //   async handler({ id, title }: { id: string; title: string }) {
  //     // ... call API
  //     return successResult({ ok: true });
  //   },
  // },
];
