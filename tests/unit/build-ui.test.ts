import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderPage } from '../../companions/build/ui.js';
import { store } from '../../companions/build/store.js';

beforeEach(() => {
  process.env.CLAUDEPANION_DATA_DIR = mkdtempSync(join(tmpdir(), 'bu-'));
});

describe('build ui', () => {
  it('renders an empty state with a textbox', async () => {
    const html = await renderPage({
      slug: 'build',
      broadcast: () => {},
      store: {} as never,
      log: () => {},
    });
    expect(html).toMatch(/<form/);
    expect(html).toMatch(/textarea/);
    expect(html).toMatch(/No requests yet/i);
  });

  it('lists existing requests with status badges', async () => {
    await store.create('scaffold a notes companion');
    const html = await renderPage({
      slug: 'build',
      broadcast: () => {},
      store: {} as never,
      log: () => {},
    });
    expect(html).toMatch(/scaffold a notes companion/);
    expect(html).toMatch(/pending/);
  });
});
