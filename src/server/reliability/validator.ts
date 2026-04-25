import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Manifest } from "../../shared/types.js";
import type { RegisteredCompanion } from "../companion-registry.js";
import { SUPPORTED_CONTRACT_VERSION } from "../companion-registry.js";

export interface ValidationIssue {
  code: string;
  message: string;
  fatal: boolean;
}

export interface ValidationReport {
  ok: boolean;
  issues: ValidationIssue[];
}

const NAME_RE = /^[a-z][a-z0-9-]*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export function validateCompanion(args: {
  manifest: unknown;
  module: Partial<RegisteredCompanion> | null;
  companionDir: string | null;
}): ValidationReport {
  const issues: ValidationIssue[] = [];
  const m = args.manifest as Partial<Manifest> | null;

  if (!m || typeof m !== "object") {
    issues.push({ code: "manifest.missing", message: "manifest export missing or not an object", fatal: true });
    return { ok: false, issues };
  }

  if (typeof m.name !== "string" || !NAME_RE.test(m.name)) {
    issues.push({
      code: "manifest.name.invalid",
      message: `name must match ${NAME_RE} — got ${JSON.stringify(m.name)}`,
      fatal: true,
    });
  }

  if (m.kind !== "entity" && m.kind !== "tool") {
    issues.push({
      code: "manifest.kind.invalid",
      message: `kind must be "entity" or "tool" — got ${JSON.stringify(m.kind)}`,
      fatal: true,
    });
  }

  if (m.contractVersion !== SUPPORTED_CONTRACT_VERSION) {
    issues.push({
      code: "manifest.contractVersion.unsupported",
      message: `host supports contractVersion ${SUPPORTED_CONTRACT_VERSION}; got ${JSON.stringify(m.contractVersion)}`,
      fatal: true,
    });
  }

  if (typeof m.version !== "string" || !SEMVER_RE.test(m.version)) {
    issues.push({
      code: "manifest.version.invalid",
      message: `version must be x.y.z — got ${JSON.stringify(m.version)}`,
      fatal: false,
    });
  }

  for (const field of ["displayName", "icon", "description"] as const) {
    const v = m[field];
    if (typeof v !== "string" || v.trim() === "") {
      issues.push({
        code: `manifest.${field}.empty`,
        message: `${field} must be a non-empty string`,
        fatal: false,
      });
    }
  }

  if (m.kind === "entity" && args.module?.tools) {
    const prefix = `${m.name}_`;
    for (const def of args.module.tools) {
      if (!def.name.startsWith(prefix)) {
        issues.push({
          code: "tool.name.namespace",
          message: `tool ${def.name} must be prefixed with ${prefix}`,
          fatal: false,
        });
      }
    }
  }

  if (args.companionDir) {
    const required = m.kind === "entity"
      ? ["form.tsx", "pages/List.tsx", "pages/Detail.tsx", "types.ts", "server/tools.ts"]
      : ["server/tools.ts"];
    for (const rel of required) {
      if (!existsSync(join(args.companionDir, rel))) {
        issues.push({
          code: "file.missing",
          message: `required file missing: ${rel}`,
          fatal: false,
        });
      }
    }
  }

  const ok = issues.every((i) => !i.fatal);
  return { ok, issues };
}
