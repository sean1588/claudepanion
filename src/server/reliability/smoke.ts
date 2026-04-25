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
      await def.handler({} as any);
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
