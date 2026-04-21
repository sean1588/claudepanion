import { z } from 'zod';
import { promises as fs } from 'node:fs';
import { dirname, join, normalize, relative, resolve, sep } from 'node:path';
import type { McpToolDefinition } from '../../../src/types.js';
import { successResult, errorResult } from '../../../src/types.js';
import { store } from '../store.js';

const FileSchema = z.object({
  path: z.string().describe('Repo-relative path, must be under companions/<slug>/ or skills/<slug>/'),
  content: z.string().describe('Full file contents'),
});

function validatePath(relPath: string, repoRoot: string): string {
  const absRepoRoot = resolve(repoRoot);
  const absTarget = resolve(absRepoRoot, relPath);
  const rel = relative(absRepoRoot, absTarget);
  if (rel.startsWith('..') || resolve(absRepoRoot, rel) !== absTarget) {
    throw new Error(`path escapes repo root: ${relPath}`);
  }
  const normRel = normalize(rel).split(sep);
  const allowedRoots = ['companions', 'skills'];
  if (!allowedRoots.includes(normRel[0])) {
    throw new Error(`path not under companions/ or skills/: ${relPath}`);
  }
  return absTarget;
}

const tool: McpToolDefinition<{
  id: string;
  files?: Array<{ path: string; content: string }>;
  summary?: string;
  error?: string;
}> = {
  name: 'complete',
  description: '[build] Finish a build. On success, writes scaffolded files atomically and renders a markdown summary. On failure, pass {error} instead of {files,summary}.',
  schema: {
    id: z.string(),
    files: z.array(FileSchema).optional(),
    summary: z.string().optional(),
    error: z.string().optional(),
  },
  async handler({ id, files, summary, error }, ctx) {
    if (error) {
      await store.fail(id, error);
      ctx.broadcast('build.request_updated', { id });
      return successResult({ ok: true });
    }
    if (!files || !summary) {
      await store.fail(id, 'complete called without files+summary or error');
      ctx.broadcast('build.request_updated', { id });
      return errorResult('must provide files+summary or error');
    }

    const repoRoot = process.env.CLAUDEPANION_REPO_ROOT ?? process.cwd();
    const stagingRoot = join(repoRoot, `.claudepanion-stage-${id}`);

    try {
      const fileRefs: Array<{ path: string; bytes: number }> = [];
      for (const f of files) {
        const absTarget = validatePath(f.path, repoRoot);
        const stagedPath = join(stagingRoot, relative(repoRoot, absTarget));
        await fs.mkdir(dirname(stagedPath), { recursive: true });
        await fs.writeFile(stagedPath, f.content);
        // collision check: if destination exists, reject
        try {
          await fs.access(absTarget);
          throw new Error(`file already exists at ${f.path}`);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        }
        fileRefs.push({ path: f.path, bytes: Buffer.byteLength(f.content) });
      }

      // move each staged file into place
      for (const f of files) {
        const absTarget = validatePath(f.path, repoRoot);
        const stagedPath = join(stagingRoot, relative(repoRoot, absTarget));
        await fs.mkdir(dirname(absTarget), { recursive: true });
        await fs.rename(stagedPath, absTarget);
      }
      await fs.rm(stagingRoot, { recursive: true, force: true });

      await store.complete(id, { summary, files: fileRefs });
      ctx.broadcast('build.request_updated', { id });
      return successResult({ ok: true, files: fileRefs });
    } catch (err) {
      await fs.rm(stagingRoot, { recursive: true, force: true }).catch(() => {});
      await store.fail(id, (err as Error).message);
      ctx.broadcast('build.request_updated', { id });
      return errorResult((err as Error).message);
    }
  },
};

export default tool;
