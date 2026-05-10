import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

function home(): string {
  // CLAUDEPANION_HOME_OVERRIDE lets tests redirect ~/.claudepanion/ without touching the real home dir.
  return process.env.CLAUDEPANION_HOME_OVERRIDE ?? homedir();
}

export function rootPath(): string {
  return join(home(), ".claudepanion");
}

export function dataPath(): string {
  return join(rootPath(), "data");
}

export function cachePath(): string {
  return join(rootPath(), "cache");
}

export function companionsPath(): string {
  return join(rootPath(), "companions");
}

export function skillsPath(): string {
  return join(rootPath(), "skills");
}

export function distPath(): string {
  return join(rootPath(), "dist");
}

export function nodeModulesPath(): string {
  return join(rootPath(), "node_modules");
}

export function ensureClaudepanionDirs(): void {
  mkdirSync(dataPath(), { recursive: true });
  mkdirSync(cachePath(), { recursive: true });
  mkdirSync(companionsPath(), { recursive: true });
  mkdirSync(skillsPath(), { recursive: true });
  mkdirSync(distPath(), { recursive: true });
  mkdirSync(nodeModulesPath(), { recursive: true });
}
