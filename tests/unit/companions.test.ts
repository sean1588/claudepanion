import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCompanions } from '../../src/companions.js';

function scaffold(slug: string, manifestOverrides: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cp-cmp-'));
  const dir = join(root, 'companions', slug);
  mkdirSync(join(dir, 'tools'), { recursive: true });
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify({ slug, name: slug, description: `d-${slug}`, ...manifestOverrides }),
  );
  writeFileSync(
    join(dir, 'tools', 'hello.ts'),
    `export default {
      name: 'hello',
      description: '[${slug}] say hello',
      schema: {},
      async handler() { return { content: [{ type: 'text', text: 'hi' }] }; },
    };`,
  );
  writeFileSync(
    join(dir, 'ui.ts'),
    `export async function renderPage() { return '<p>${slug}</p>'; }`,
  );
  return root;
}

describe('loadCompanions', () => {
  it('discovers a minimal companion', async () => {
    const root = scaffold('demo');
    const companions = await loadCompanions(join(root, 'companions'));
    expect(companions).toHaveLength(1);
    expect(companions[0].slug).toBe('demo');
    expect(companions[0].tools.map((t) => t.name)).toEqual(['demo_hello']);
  });

  it('rejects invalid slug in manifest', async () => {
    const root = scaffold('Bad_Slug');
    await expect(loadCompanions(join(root, 'companions'))).rejects.toThrow(/slug/i);
  });

  it('rejects duplicate slugs', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cp-cmp-'));
    const cDir = join(root, 'companions');
    for (const dir of ['a-dir', 'b-dir']) {
      const d = join(cDir, dir);
      mkdirSync(join(d, 'tools'), { recursive: true });
      writeFileSync(
        join(d, 'manifest.json'),
        JSON.stringify({ slug: 'dup', name: 'dup', description: 'x' }),
      );
      writeFileSync(
        join(d, 'ui.ts'),
        `export async function renderPage() { return ''; }`,
      );
    }
    await expect(loadCompanions(cDir)).rejects.toThrow(/duplicate/i);
  });

  it('returns empty list when companions/ is missing', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cp-cmp-'));
    const companions = await loadCompanions(join(root, 'companions'));
    expect(companions).toEqual([]);
  });

  it('surfaces syntax errors in ui.ts', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cp-cmp-'));
    const dir = join(root, 'companions', 'brokenui');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'manifest.json'),
      JSON.stringify({ slug: 'brokenui', name: 'x', description: 'x' }),
    );
    writeFileSync(join(dir, 'ui.ts'), 'export const renderPage = (;;;');
    await expect(loadCompanions(join(root, 'companions'))).rejects.toThrow(/syntax|unexpected/i);
  });
});
