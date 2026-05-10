import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

function npmInstall(packages: string[], cwd: string): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("npm", ["install", ...packages], { cwd, shell: false });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => resolve({ ok: code === 0, stderr }));
    proc.on("error", (err) => resolve({ ok: false, stderr: err.message }));
  });
}

function npmBuild(cwd: string): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("npm", ["run", "build"], { cwd, shell: false });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.stdout.on("data", () => { /* swallow on success */ });
    proc.on("close", (code) => resolve({ ok: code === 0, stderr }));
    proc.on("error", (err) => resolve({ ok: false, stderr: err.message }));
  });
}

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
import { callRemount } from "./remount.js";

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
  if (missing.length > 0 && (opts.installDeps ?? true)) {
    const r = await npmInstall(missing, cwd);
    if (!r.ok) {
      return { ok: false, stage: "deps", error: `npm install failed: ${r.stderr.slice(0, 1000)}`, remediation: "check package name / network; re-run" };
    }
    dependenciesAdded = missing;
  } else if (missing.length > 0) {
    // Tests pass installDeps: false — just record without installing
    dependenciesAdded = missing;
  }
  stagesRun.push("deps");

  if (opts.runBuild ?? true) {
    const r = await npmBuild(cwd);
    if (!r.ok) {
      return { ok: false, stage: "build", error: `npm run build failed: ${r.stderr.slice(0, 2000)}`, remediation: "fix the type/syntax error in the file the compiler names; re-run" };
    }
    stagesRun.push("build");
  }

  if (opts.runRemount ?? true) {
    const r = await callRemount(slug, opts.port);
    if (!r.ok) {
      console.warn(`[scaffold] remount skipped: ${r.error}. Restart 'claudepanion serve' to pick up changes.`);
    }
    stagesRun.push("remount");
  }

  return { ok: true, slug, kind: "ui", stagesRun, filesGenerated, dependenciesAdded };
}
