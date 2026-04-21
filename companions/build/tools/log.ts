import { z } from 'zod';
import type { McpToolDefinition } from '../../../src/types.js';
import { successResult, errorResult } from '../../../src/types.js';
import { store } from '../store.js';

const tool: McpToolDefinition<{ id: string; message: string }> = {
  name: 'log',
  description: '[build] Append a progress line to a running build. Streams live to the UI.',
  schema: {
    id: z.string().describe('Request id'),
    message: z.string().describe('One-line progress update'),
  },
  async handler({ id, message }, ctx) {
    try {
      await store.log(id, message);
      ctx.broadcast('build.log_appended', { id, message, at: new Date().toISOString() });
      return successResult({ ok: true });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
};

export default tool;
