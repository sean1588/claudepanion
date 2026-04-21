import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import list from '../../companions/build/tools/list.js';
import claim from '../../companions/build/tools/claim.js';
import log from '../../companions/build/tools/log.js';
import complete from '../../companions/build/tools/complete.js';
import { store } from '../../companions/build/store.js';

function ctx() {
  const events: Array<{ event: string; data: unknown }> = [];
  return {
    slug: 'build',
    broadcast: (event: string, data: unknown) => events.push({ event, data }),
    store: {} as never,
    log: () => {},
    events,
  };
}

beforeEach(() => {
  process.env.CLAUDEPANION_DATA_DIR = mkdtempSync(join(tmpdir(), 'bt-data-'));
  process.env.CLAUDEPANION_REPO_ROOT = mkdtempSync(join(tmpdir(), 'bt-repo-'));
});

describe('build tools', () => {
  it('list returns empty initially', async () => {
    const res = await list.handler({}, ctx());
    expect(res.content[0].text).toMatch(/"requests": \[\]/);
  });

  it('claim → log → complete writes files and broadcasts', async () => {
    const req = await store.create('scaffold foo');
    const c = ctx();

    const claimed = await claim.handler({ id: req.id, expectedVersion: req.version }, c);
    expect(claimed.isError).toBeFalsy();
    expect(c.events.find((e) => e.event === 'build.request_updated')).toBeTruthy();

    await log.handler({ id: req.id, message: 'writing manifest' }, c);
    expect(c.events.find((e) => e.event === 'build.log_appended')).toBeTruthy();

    const completed = await complete.handler(
      {
        id: req.id,
        summary: '# Scaffolded `foo`',
        files: [
          { path: 'companions/foo/manifest.json', content: '{"slug":"foo","name":"Foo","description":"d"}' },
          { path: 'skills/foo/SKILL.md', content: '---\nname: foo\n---\n# foo' },
        ],
      },
      c,
    );
    expect(completed.isError).toBeFalsy();

    const repoRoot = process.env.CLAUDEPANION_REPO_ROOT!;
    expect(existsSync(join(repoRoot, 'companions/foo/manifest.json'))).toBe(true);
    expect(existsSync(join(repoRoot, 'skills/foo/SKILL.md'))).toBe(true);

    const got = await store.get(req.id);
    expect(got?.status).toBe('done');
    expect(got?.result?.files).toHaveLength(2);
  });

  it('complete rejects path traversal', async () => {
    const req = await store.create('evil');
    await claim.handler({ id: req.id, expectedVersion: req.version }, ctx());
    const res = await complete.handler(
      {
        id: req.id,
        summary: 'x',
        files: [{ path: '../../../etc/pwn', content: 'boom' }],
      },
      ctx(),
    );
    expect(res.isError).toBe(true);
    const got = await store.get(req.id);
    expect(got?.status).toBe('failed');
  });

  it('complete rejects writes outside companions/ and skills/', async () => {
    const req = await store.create('x');
    await claim.handler({ id: req.id, expectedVersion: req.version }, ctx());
    const res = await complete.handler(
      {
        id: req.id,
        summary: 'x',
        files: [{ path: 'src/evil.ts', content: 'boom' }],
      },
      ctx(),
    );
    expect(res.isError).toBe(true);
  });

  it('complete with {error} marks failed without writing files', async () => {
    const req = await store.create('x');
    await claim.handler({ id: req.id, expectedVersion: req.version }, ctx());
    const res = await complete.handler({ id: req.id, error: 'it broke' }, ctx());
    expect(res.isError).toBeFalsy();
    const got = await store.get(req.id);
    expect(got?.status).toBe('failed');
    expect(got?.error).toBe('it broke');
  });
});
