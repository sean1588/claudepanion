import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Manifest } from "../../shared/types.js";
import type { RegisteredCompanion } from "../companion-registry.js";
import { SUPPORTED_CONTRACT_VERSION } from "../companion-registry.js";

function camelize(slug: string): string {
  return slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

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

  for (const field of ["requiredEnv", "optionalEnv"] as const) {
    const v = (m as any)[field];
    if (v !== undefined && (!Array.isArray(v) || v.some((x) => typeof x !== "string"))) {
      issues.push({
        code: `manifest.${field}.invalid`,
        message: `${field} must be a string[] when present`,
        fatal: false,
      });
    }
  }

  if (m.kind === "entity" && args.module?.tools && typeof m.name === "string") {
    // Tool names can't contain hyphens, so the slug's hyphens become underscores.
    // §15a: prefix = slug-with-underscores + "_"
    const prefix = `${m.name.replace(/-/g, "_")}_`;
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

  // §16f.1 — requiredEnv declared but no proxy tools = Build did not author server/tools.ts
  if (m.kind === "entity" && Array.isArray(m.requiredEnv) && m.requiredEnv.length > 0) {
    const toolCount = args.module?.tools?.length ?? 0;
    if (toolCount === 0) {
      issues.push({
        code: "tools.empty_with_requiredEnv",
        message: `manifest.requiredEnv declares ${m.requiredEnv.join(", ")} but server/tools.ts exports no tools — Build did not author the proxy tools (scaffold-spec §16f.1)`,
        fatal: true,
      });
    }
  }

  // §16f.2 — env vars referenced in handler bodies must match manifest.requiredEnv
  if (args.companionDir) {
    const toolsSrcPath = join(args.companionDir, "server/tools.ts");
    if (existsSync(toolsSrcPath)) {
      try {
        const src = readFileSync(toolsSrcPath, "utf8");
        const referenced = new Set<string>();
        const re = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
        let match: RegExpExecArray | null;
        while ((match = re.exec(src)) !== null) {
          referenced.add(match[1]);
        }
        const declared = new Set<string>(Array.isArray(m.requiredEnv) ? (m.requiredEnv as string[]) : []);
        for (const ref of referenced) {
          if (!declared.has(ref)) {
            issues.push({
              code: "env.referenced_not_declared",
              message: `process.env.${ref} referenced in server/tools.ts but not in manifest.requiredEnv (§16f.2)`,
              fatal: false,
            });
          }
        }
        for (const dec of declared) {
          if (!referenced.has(dec)) {
            issues.push({
              code: "env.declared_not_used",
              message: `${dec} declared in manifest.requiredEnv but no handler reads process.env.${dec} (§16f.2)`,
              fatal: false,
            });
          }
        }
      } catch {
        // unreadable — skip silently
      }
    }
  }

  // Skill file exists + has the expected frontmatter
  // (gated on manifest.ts existing on disk so synthetic test fixtures don't trip this)
  if (
    args.companionDir &&
    typeof m.name === "string" &&
    NAME_RE.test(m.name) &&
    existsSync(join(args.companionDir, "manifest.ts"))
  ) {
    const skillPath = resolve(args.companionDir, "..", "..", "skills", `${m.name}-companion`, "SKILL.md");
    if (!existsSync(skillPath)) {
      issues.push({
        code: "skill.missing",
        message: `skill file missing: skills/${m.name}-companion/SKILL.md`,
        fatal: true,
      });
    } else {
      try {
        const skillSrc = readFileSync(skillPath, "utf8");
        const fmMatch = skillSrc.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) {
          issues.push({
            code: "skill.frontmatter.missing",
            message: "skill file missing YAML frontmatter",
            fatal: true,
          });
        } else {
          const fm = fmMatch[1];
          const expectedName = `name: ${m.name}-companion`;
          if (!fm.includes(expectedName)) {
            issues.push({
              code: "skill.frontmatter.name",
              message: `skill frontmatter must include "${expectedName}"`,
              fatal: false,
            });
          }
          const expectedDescPrefix = `Use when the user pastes "/${m.name}-companion`;
          if (!fm.includes(expectedDescPrefix)) {
            issues.push({
              code: "skill.frontmatter.description",
              message: `skill frontmatter description must start with: ${expectedDescPrefix}`,
              fatal: false,
            });
          }
        }
      } catch {
        // unreadable — skip silently
      }
    }
  }

  // companions/<name>/index.ts must export the camelCase binding
  if (args.companionDir && typeof m.name === "string" && NAME_RE.test(m.name)) {
    const indexPath = join(args.companionDir, "index.ts");
    if (existsSync(indexPath)) {
      try {
        const indexSrc = readFileSync(indexPath, "utf8");
        const camel = camelize(m.name);
        const exportRe = new RegExp(`\\bexport\\s+const\\s+${camel}\\b`);
        if (!exportRe.test(indexSrc)) {
          issues.push({
            code: "index.export.missing",
            message: `companions/${m.name}/index.ts must export const ${camel}: RegisteredCompanion`,
            fatal: true,
          });
        }
      } catch {
        // unreadable — skip silently
      }
    }
  }

  const ok = issues.every((i) => !i.fatal);
  return { ok, issues };
}
