import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import type { Companion, CompanionManifest, McpToolDefinition } from './types.js';

const SLUG_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Returns true when `err` indicates that the module/file simply doesn't exist.
 * Node has emitted different codes across versions and for ESM vs CJS paths.
 */
function isModuleNotFound(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException).code;
  return code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND' || code === 'ENOENT';
}

async function listDirs(path: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(path, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function loadToolsDir(dir: string, slug: string): Promise<McpToolDefinition[]> {
  const toolFiles: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.js'))) {
        toolFiles.push(e.name);
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  toolFiles.sort();
  const tools: McpToolDefinition[] = [];
  for (const f of toolFiles) {
    const mod = await import(pathToFileURL(join(dir, f)).href);
    const def = (mod.default ?? mod.tool) as McpToolDefinition | undefined;
    if (!def) {
      throw new Error(`tool file ${join(dir, f)} has no default export`);
    }
    tools.push({ ...def, name: `${slug}_${def.name}` });
  }
  return tools;
}

export async function loadCompanions(companionsDir: string): Promise<Companion[]> {
  const dirs = await listDirs(companionsDir);
  const loaded: Companion[] = [];
  const seenSlugs = new Set<string>();
  for (const dirName of dirs) {
    const dir = join(companionsDir, dirName);
    const manifestPath = join(dir, 'manifest.json');
    const manifestRaw = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw) as CompanionManifest;
    if (!SLUG_RE.test(manifest.slug)) {
      throw new Error(
        `invalid slug "${manifest.slug}" in ${manifestPath} — must match ${SLUG_RE}`,
      );
    }
    if (seenSlugs.has(manifest.slug)) {
      throw new Error(`duplicate slug "${manifest.slug}" at ${manifestPath}`);
    }
    seenSlugs.add(manifest.slug);

    const tools = await loadToolsDir(join(dir, 'tools'), manifest.slug);

    let uiMod: Record<string, unknown>;
    try {
      uiMod = await import(pathToFileURL(join(dir, 'ui.ts')).href);
    } catch (err) {
      if (!isModuleNotFound(err)) throw err;
      uiMod = await import(pathToFileURL(join(dir, 'ui.js')).href);
    }
    const renderPage = uiMod.renderPage as Companion['renderPage'];
    if (typeof renderPage !== 'function') {
      throw new Error(`${dir}/ui.ts must export renderPage`);
    }

    let router: Companion['router'] = null;
    try {
      let routesMod: Record<string, unknown>;
      try {
        routesMod = await import(pathToFileURL(join(dir, 'routes.ts')).href);
      } catch (err) {
        if (!isModuleNotFound(err)) throw err;
        routesMod = await import(pathToFileURL(join(dir, 'routes.js')).href);
      }
      router = (routesMod.default ?? null) as Companion['router'];
    } catch (err) {
      if (!isModuleNotFound(err)) throw err;
      router = null;
    }

    loaded.push({
      slug: manifest.slug,
      name: manifest.name,
      description: manifest.description,
      icon: manifest.icon,
      tools,
      renderPage,
      router,
    });
  }
  return loaded;
}
