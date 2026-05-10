import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderRegistryIndex, renderClientIndex, slugToCamelCase } from "./codegen.js";

function hasInputSchema(typesTsPath: string): boolean {
  if (!existsSync(typesTsPath)) return false;
  return /\bexport\s+const\s+InputSchema\b/.test(readFileSync(typesTsPath, "utf8"));
}

export async function runRegenerate(opts: { cwd?: string } = {}): Promise<
  { ok: true; filesGenerated: string[] } | { ok: false; error: string }
> {
  const cwd = opts.cwd ?? process.cwd();
  const compsDir = join(cwd, "companions");
  if (!existsSync(compsDir)) {
    return { ok: false, error: "companions/ directory not found" };
  }

  const allSlugs = readdirSync(compsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() || e.isSymbolicLink())
    .map((e) => e.name)
    .filter((name) => existsSync(join(compsDir, name, "manifest.ts")));

  const descriptors = allSlugs.map((s) => ({ slug: s, camelCase: slugToCamelCase(s) }));
  writeFileSync(join(compsDir, "index.ts"), renderRegistryIndex(descriptors));

  const clientDescriptors = allSlugs.map((s) => ({
    slug: s,
    camelCase: slugToCamelCase(s),
    hasForm: existsSync(join(compsDir, s, "form.tsx")),
    hasDetail: existsSync(join(compsDir, s, "pages/Detail.tsx")),
    hasList: existsSync(join(compsDir, s, "pages/List.tsx")),
    hasInputSchema: hasInputSchema(join(compsDir, s, "types.ts")),
  }));
  writeFileSync(join(compsDir, "client.ts"), renderClientIndex(clientDescriptors));

  return { ok: true, filesGenerated: ["companions/index.ts", "companions/client.ts"] };
}
