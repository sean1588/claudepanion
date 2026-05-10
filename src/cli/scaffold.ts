import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function detectMissingDeps(toolsTsPath: string, packageJsonPath: string): string[] {
  if (!existsSync(toolsTsPath)) return [];
  const src = readFileSync(toolsTsPath, "utf8");
  const importRe = /\bimport\s+(?:[^"']+from\s+)?["']([^"']+)["']/g;
  const imports = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(src))) {
    const spec = match[1];
    if (!spec.startsWith(".") && !spec.startsWith("node:")) {
      const pkg = spec.startsWith("@")
        ? spec.split("/").slice(0, 2).join("/")
        : spec.split("/")[0];
      imports.add(pkg);
    }
  }
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const deps = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
  return [...imports].filter((p) => !deps.has(p));
}
import {
  renderCompanionIndex,
  renderRegistryIndex,
  renderClientIndex,
  slugToCamelCase,
  type CompanionDescriptor,
  type ClientDescriptor,
} from "./codegen.js";

export interface ScaffoldOptions {
  cwd?: string;
  runBuild?: boolean;
  runRemount?: boolean;
  runSelfCheck?: boolean;
  installDeps?: boolean;
  port?: number;
}

export type ScaffoldResult =
  | {
      ok: true;
      slug: string;
      kind: string;
      stagesRun: string[];
      filesGenerated: string[];
      dependenciesAdded: string[];
    }
  | { ok: false; stage: string; error: string; remediation?: string };

export async function runScaffold(slug: string, opts: ScaffoldOptions = {}): Promise<ScaffoldResult> {
  const cwd = opts.cwd ?? process.cwd();
  const stagesRun: string[] = [];
  const filesGenerated: string[] = [];

  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    return { ok: false, stage: "validate", error: `invalid slug: ${slug}`, remediation: "fix slug; re-run" };
  }
  const compDir = join(cwd, "companions", slug);
  if (!existsSync(join(compDir, "manifest.ts"))) {
    return { ok: false, stage: "validate", error: `manifest.ts missing for ${slug}`, remediation: "author companions/<slug>/manifest.ts" };
  }
  stagesRun.push("validate");

  const camelCase = slugToCamelCase(slug);
  writeFileSync(join(compDir, "index.ts"), renderCompanionIndex({ slug, camelCase }));
  filesGenerated.push(`companions/${slug}/index.ts`);

  const allSlugs = readdirSync(join(cwd, "companions"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => existsSync(join(cwd, "companions", name, "manifest.ts")));

  const descriptors: CompanionDescriptor[] = allSlugs.map((s) => ({ slug: s, camelCase: slugToCamelCase(s) }));
  writeFileSync(join(cwd, "companions/index.ts"), renderRegistryIndex(descriptors));
  filesGenerated.push("companions/index.ts");

  const clientDescriptors: ClientDescriptor[] = allSlugs.map((s) => {
    const sd = join(cwd, "companions", s);
    return {
      slug: s,
      camelCase: slugToCamelCase(s),
      hasForm: existsSync(join(sd, "form.tsx")),
      hasDetail: existsSync(join(sd, "pages/Detail.tsx")),
      hasList: existsSync(join(sd, "pages/List.tsx")),
    };
  });
  writeFileSync(join(cwd, "companions/client.ts"), renderClientIndex(clientDescriptors));
  filesGenerated.push("companions/client.ts");
  stagesRun.push("codegen");

  const toolsTsPath = join(compDir, "server/tools.ts");
  const packageJsonPath = join(cwd, "package.json");
  const missing = detectMissingDeps(toolsTsPath, packageJsonPath);
  let dependenciesAdded: string[] = [];
  if (missing.length > 0 && opts.installDeps === false) {
    // Test path: just record without installing
    dependenciesAdded = missing;
  } else if (missing.length > 0) {
    // Install deferred to Task 4.4 — for now, just record what would be installed
    dependenciesAdded = missing;
  }
  stagesRun.push("deps");

  return { ok: true, slug, kind: "ui", stagesRun, filesGenerated, dependenciesAdded };
}
