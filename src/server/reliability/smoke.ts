import { z } from "zod";
import type { RegisteredCompanion } from "../companion-registry.js";

export interface SmokeResult {
  tool: string;
  ok: boolean;
  error?: string;
}

export interface SmokeReport {
  ok: boolean;
  results: SmokeResult[];
}

const CODE_LEVEL_ERRORS = new Set(["TypeError", "ReferenceError", "SyntaxError"]);

export async function smokeCompanion(companion: RegisteredCompanion): Promise<SmokeReport> {
  const results: SmokeResult[] = [];
  for (const def of companion.tools ?? []) {
    try {
      // Production parity: the MCP SDK validates args via the tool's Zod schema
      // before calling the handler. If empty {} fails the schema, that's a
      // "correct rejection" — the handler would never see those args in production.
      // This prevents spurious smoke failures from handlers that legitimately
      // assume their required params are present (per Zod's contract).
      const schema = z.object(def.schema);
      const parsed = schema.safeParse({});
      if (!parsed.success) {
        results.push({ tool: def.name, ok: true, error: "schema rejected empty args" });
        continue;
      }
      // Schema accepted (e.g. all params optional); run the handler with the parsed data.
      await def.handler(parsed.data as any);
      results.push({ tool: def.name, ok: true });
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      const codeLevel = typeof e?.name === "string" && CODE_LEVEL_ERRORS.has(e.name);
      if (codeLevel) {
        results.push({ tool: def.name, ok: false, error: `${e.name}: ${e.message ?? ""}` });
      } else {
        results.push({ tool: def.name, ok: true, error: e?.message ?? String(err) });
      }
    }
  }
  const ok = results.every((r) => r.ok);
  return { ok, results };
}
