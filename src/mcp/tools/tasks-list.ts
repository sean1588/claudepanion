import { getTasks } from '../../store.js';
import { McpToolDefinition, successResult } from '../types.js';

export const tasksListTool: McpToolDefinition<Record<string, never>> = {
  name: 'tasks_list',
  description: 'List all tasks.',
  schema: {},
  async handler() {
    return successResult({ tasks: await getTasks() });
  },
};
