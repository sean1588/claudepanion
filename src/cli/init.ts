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

  return { ok: true, symlinks, filesCreated };
}
