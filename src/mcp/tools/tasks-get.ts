import { z } from 'zod';
import { getTask } from '../../store.js';
import { McpToolDefinition, errorResult, successResult } from '../types.js';

export const tasksGetTool: McpToolDefinition<{ id: string }> = {
  name: 'tasks_get',
  description: 'Get a single task by id.',
  schema: { id: z.string().min(1).describe('Task id') },
  async handler({ id }) {
    const task = await getTask(id);
    if (!task) return errorResult(`task not found: ${id}`);
    return successResult({ task });
  },
};
