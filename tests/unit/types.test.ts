import { describe, it, expectTypeOf } from 'vitest';
import type { Companion, CompanionContext, McpToolDefinition } from '../../src/types.js';
import { z } from 'zod';

describe('Companion types', () => {
  it('Companion has required fields', () => {
    const c: Companion = {
      slug: 'demo',
      name: 'Demo',
      description: 'desc',
      tools: [],
      renderPage: async () => '',
      router: null,
    };
    expectTypeOf(c.slug).toBeString();
  });

  it('CompanionContext exposes broadcast, store, slug, log', () => {
    expectTypeOf<CompanionContext>().toHaveProperty('broadcast');
    expectTypeOf<CompanionContext>().toHaveProperty('store');
    expectTypeOf<CompanionContext>().toHaveProperty('slug');
    expectTypeOf<CompanionContext>().toHaveProperty('log');
  });

  it('McpToolDefinition has name, description, schema, handler', () => {
    const t: McpToolDefinition<{ x: string }> = {
      name: 'x',
      description: 'x',
      schema: { x: z.string() },
      async handler(p, ctx) {
        return { content: [{ type: 'text', text: p.x }] };
      },
    };
    expectTypeOf(t.name).toBeString();
  });
});
