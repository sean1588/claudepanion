import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve as pathResolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Framework root (compiled file lives at dist/src/cli/scaffold.js).
// Used to find the bundled tsc binary and read framework-provided deps.
const frameworkRoot = pathResolve(fileURLToPath(import.meta.url), "../../../..");

function npmInstall(packages: string[], cwd: string): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("npm", ["install", ...packages], { cwd, shell: false });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => resolve({ ok: code === 0, stderr }));
    proc.on("error", (err) => resolve({ ok: false, stderr: err.message }));
  });
}

function tscBuild(cwd: string): Promise<{ ok: boolean; stderr: string }> {
  // Shell out to the framework's bundled tsc directly. The user-local home's
  // package.json has no "build" script (init writes a minimal scripts: {});
  // and even if it did, we'd want to control the invocation centrally so the
  // emit behavior matches init's behavior.
  return new Promise((resolve) => {
    const tscPath = join(frameworkRoot, "node_modules/.bin/tsc");
    const proc = spawn(tscPath, ["-p", cwd], { cwd, shell: false });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.stdout.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      // tsc may exit non-zero from type errors (e.g. type-only imports in the
      // symlinked Build companion that don't resolve from user-local cwd) while
      // still emitting valid JS. Trust the file-existence check downstream.
      resolve({ ok: code === 0, stderr });
    });
    proc.on("error", (err) => resolve({ ok: false, stderr: err.message }));
  });
}

// Imports that look like npm packages but are framework-provided via the
// claudepanion-host symlink, not installable from the registry.
const FRAMEWORK_PROVIDED = new Set<string>(["claudepanion-host"]);

function hasInputSchema(typesTsPath: string): boolean {
  if (!existsSync(typesTsPath)) return false;
  return /\bexport\s+const\s+InputSchema\b/.test(readFileSync(typesTsPath, "utf8"));
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
  return [...imports].filter((p) => !deps.has(p) && !FRAMEWORK_PROVIDED.has(p));
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
import { validateCompanion } from "../server/reliability/validator.js";
import { smokeCompanion } from "../server/reliability/smoke.js";

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

  // Include symlinks too — the framework's Build companion is symlinked into
  // user-local installs. The existsSync(.../manifest.ts) gate downstream
  // drops broken or non-companion-shaped entries.
  const allSlugs = readdirSync(join(cwd, "companions"), { withFileTypes: true })
    .filter((e) => e.isDirectory() || e.isSymbolicLink())
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
      hasInputSchema: hasInputSchema(join(sd, "types.ts")),
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

  // npm install rebuilds node_modules and wipes the framework symlinks that
  // init creates. Re-link before any operation that depends on resolving
  // `claudepanion-host` (tsc, dynamic import in self-check).
  const { ensureSymlinks } = await import("./init.js");
  const linkResult = ensureSymlinks(cwd, frameworkRoot);
  if (!linkResult.ok) {
    return { ok: false, stage: linkResult.stage, error: linkResult.error };
  }

  if (opts.runBuild ?? true) {
    const r = await tscBuild(cwd);
    // Type-error-only failures still emit JS; verify by checking the dist output.
    const distIndex = join(cwd, "dist/companions", slug, "index.js");
    if (!r.ok && !existsSync(distIndex)) {
      return { ok: false, stage: "build", error: `tsc failed: ${r.stderr.slice(0, 2000)}`, remediation: "fix the type/syntax error in the file the compiler names; re-run" };
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

  if (opts.runSelfCheck ?? true) {
    const distPath = join(cwd, "dist/companions", slug, "index.js");
    let companion: any;
    try {
      const mod = await import(`${distPath}?t=${Date.now()}`);
      companion = mod.default ?? mod[slug] ?? mod[slugToCamelCase(slug)];
    } catch (err) {
      return { ok: false, stage: "self-check", error: `failed to import dist module: ${(err as Error).message}`, remediation: "check that npm run build completed; re-run" };
    }
    const validator = validateCompanion({ manifest: companion?.manifest, module: companion, companionDir: compDir });
    if (!validator.ok) {
      const fatals = validator.issues.filter((i) => i.fatal).map((i) => i.message).join("; ");
      return { ok: false, stage: "self-check", error: `validator: ${fatals}`, remediation: "read issues; fix file; re-run" };
    }
    const smoke = await smokeCompanion(companion);
    if (!smoke.ok) {
      const errors = smoke.results.filter((r) => !r.ok).map((r) => `${r.tool}: ${r.error}`).join("; ");
      return { ok: false, stage: "self-check", error: `smoke: ${errors}`, remediation: "fix tool handler; re-run" };
    }
    stagesRun.push("self-check");
  }

  return { ok: true, slug, kind: "ui", stagesRun, filesGenerated, dependenciesAdded };
}
