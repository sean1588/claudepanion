import type { McpToolDefinition } from '../../../src/types.js';
import { successResult } from '../../../src/types.js';
import { store } from '../store.js';

const tool: McpToolDefinition<Record<string, never>> = {
  name: 'list',
  description: '[build] List pending / running / completed build requests.',
  schema: {},
  async handler() {
    return successResult({ requests: await store.list() });
  },
};

export default tool;
