import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

export interface RunInitOptions {
  home: string;
  frameworkRoot: string;
  force?: boolean;
}

export interface RunInitSuccess {
  ok: true;
  symlinks: { path: string; target: string }[];
  filesCreated: string[];
}

export interface RunInitFailure {
  ok: false;
  stage: "validate" | "files" | "symlinks";
  error: string;
}

export type RunInitResult = RunInitSuccess | RunInitFailure;

const HOME_PKG_NAME = "claudepanion-home";

const SYMLINKS: Array<{ rel: string; target: (frameworkRoot: string) => string }> = [
  { rel: "companions/build", target: (fr) => join(fr, "companions/build") },
  { rel: "skills/build-companion", target: (fr) => join(fr, "skills/build-companion") },
  { rel: "node_modules/claudepanion-host", target: (fr) => fr },
];

const REAL_DIRS = ["data", "cache", "dist", "companions", "skills", "node_modules"];

const DEFAULT_PACKAGE_JSON = {
  name: HOME_PKG_NAME,
  private: true,
  type: "module",
  dependencies: {},
};

const DEFAULT_GITIGNORE = [
  "node_modules/",
  "data/",
  "cache/",
  "dist/",
  ".env",
  ".env.*",
  "",
].join("\n");

const DEFAULT_TSCONFIG = {
  extends: "claudepanion-host/tsconfig.base.json",
  compilerOptions: {
    outDir: "dist",
    rootDir: ".",
  },
  include: ["companions/**/*.ts"],
  exclude: ["node_modules", "dist"],
};

export async function runInit(opts: RunInitOptions): Promise<RunInitResult> {
  // Validate: refuse to clobber non-claudepanion content.
  const pkgPath = join(opts.home, "package.json");
  const homeExists = existsSync(opts.home);
  if (homeExists && existsSync(pkgPath) && !opts.force) {
    try {
      const existing = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (existing.name !== HOME_PKG_NAME) {
        return {
          ok: false,
          stage: "validate",
          error: `${opts.home}/package.json exists but is not a claudepanion home (name="${existing.name}"). Run with --force to override.`,
        };
      }
    } catch (err) {
      return {
        ok: false,
        stage: "validate",
        error: `failed to parse existing package.json: ${(err as Error).message}`,
      };
    }
  }

  // Create real dirs + files.
  mkdirSync(opts.home, { recursive: true });
  const filesCreated: string[] = [];
  for (const dir of REAL_DIRS) {
    mkdirSync(join(opts.home, dir), { recursive: true });
  }
  if (!existsSync(pkgPath) || opts.force) {
    writeFileSync(pkgPath, JSON.stringify(DEFAULT_PACKAGE_JSON, null, 2) + "\n");
    filesCreated.push("package.json");
  }
  const giPath = join(opts.home, ".gitignore");
  if (!existsSync(giPath) || opts.force) {
    writeFileSync(giPath, DEFAULT_GITIGNORE);
    filesCreated.push(".gitignore");
  }
  const tsPath = join(opts.home, "tsconfig.json");
  if (!existsSync(tsPath) || opts.force) {
    writeFileSync(tsPath, JSON.stringify(DEFAULT_TSCONFIG, null, 2) + "\n");
    filesCreated.push("tsconfig.json");
  }

  // Create / refresh symlinks idempotently.
  const symlinks: { path: string; target: string }[] = [];
  for (const { rel, target } of SYMLINKS) {
    const linkPath = join(opts.home, rel);
    const targetPath = target(opts.frameworkRoot);
    // Remove existing entry if it's a symlink (refresh) or a stale broken link.
    try {
      const stat = lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        unlinkSync(linkPath);
      } else if (stat.isDirectory() || stat.isFile()) {
        return {
          ok: false,
          stage: "symlinks",
          error: `${linkPath} exists as a real file/dir; refusing to replace with symlink`,
        };
      }
    } catch {
      // doesn't exist; fine.
    }
    mkdirSync(join(linkPath, ".."), { recursive: true });
    symlinkSync(targetPath, linkPath);
    symlinks.push({ path: linkPath, target: targetPath });
  }

  // Generate companions/index.ts + client.ts from disk state.
  const { runRegenerate } = await import("./regenerate.js");
  const regenResult = await runRegenerate({ cwd: opts.home });
  if (!regenResult.ok) {
    return { ok: false, stage: "files", error: `regenerate failed: ${regenResult.error}` };
  }

  // Compile the freshly-written index.ts to dist/companions/index.js.
  // We shell out to tsc rather than reimplementing — guarantees the user-local
  // tsconfig is honored.
  const tscPath = join(opts.frameworkRoot, "node_modules/.bin/tsc");
  const tscResult = await new Promise<{ code: number; stderr: string }>((resolve) => {
    const tsc = spawn(tscPath, ["-p", opts.home, "--noEmitOnError", "false"], { cwd: opts.home });
    let stderr = "";
    tsc.stderr.on("data", (d) => { stderr += d.toString(); });
    tsc.on("close", (code) => resolve({ code: code ?? 1, stderr }));
    tsc.on("error", (err) => resolve({ code: 1, stderr: err.message }));
  });
  // tsc may exit non-zero due to type errors in symlinked companions (import type
  // declarations that reference framework internals).  Emit still happens because
  // noEmitOnError is false.  We only treat it as a hard failure when the expected
  // output file was not produced (i.e. tsc couldn't parse / write at all).
  const distIndex = join(opts.home, "dist/companions/index.js");
  if (!existsSync(distIndex)) {
    return {
      ok: false,
      stage: "files",
      error: `tsc failed: ${tscResult.stderr.slice(0, 500)}`,
    };
  }

  return { ok: true, symlinks, filesCreated };
}
