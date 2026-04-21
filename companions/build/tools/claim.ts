import { z } from 'zod';
import type { McpToolDefinition } from '../../../src/types.js';
import { successResult, errorResult } from '../../../src/types.js';
import { store } from '../store.js';

const tool: McpToolDefinition<{ id: string; expectedVersion: number }> = {
  name: 'claim',
  description: '[build] Claim a pending build request. Moves status → running. Pass the current version of the request; returns conflict if version is stale.',
  schema: {
    id: z.string().describe('Request id to claim'),
    expectedVersion: z.number().int().describe('Current version of the request (from list)'),
  },
  async handler({ id, expectedVersion }, ctx) {
    try {
      const claimed = await store.claim(id, expectedVersion);
      ctx.broadcast('build.request_updated', { request: claimed });
      return successResult({ request: claimed });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
};

export default tool;
