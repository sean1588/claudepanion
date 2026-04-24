import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Registry } from "./companion-registry.js";

function toCamel(slug: string): string {
  return slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Rewrite companions/index.ts so in-memory registry entries are re-exported
 * from the file. Local companions keep relative imports; installed (npm)
 * companions use bare imports of their package name.
 */
export async function rewriteCompanionsIndex(repoRoot: string, registry: Registry): Promise<void> {
  const entries = [...registry.list()].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
  const lines: string[] = [
    `import type { RegisteredCompanion } from "../src/server/companion-registry.js";`,
  ];
  for (const c of entries) {
    const ident = toCamel(c.manifest.name);
    const source = (c as { source?: "local" | "installed" }).source ?? "local";
    if (source === "installed") {
      lines.push(`import { ${ident} } from "claudepanion-${c.manifest.name}";`);
    } else {
      lines.push(`import { ${ident} } from "./${c.manifest.name}/index.js";`);
    }
  }
  lines.push("");
  lines.push(`export const companions: RegisteredCompanion[] = [${entries.map((c) => toCamel(c.manifest.name)).join(", ")}];`);
  lines.push("");
  const contents = lines.join("\n");
  const path = resolve(repoRoot, "companions/index.ts");
  const existing = await readFile(path, "utf-8").catch(() => "");
  if (existing !== contents) await writeFile(path, contents, "utf-8");
}
