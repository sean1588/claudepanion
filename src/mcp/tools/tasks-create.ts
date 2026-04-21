import { z } from 'zod';
import { createTask } from '../../store.js';
import { McpToolDefinition, successResult } from '../types.js';

export const tasksCreateTool: McpToolDefinition<{ title: string; description?: string }> = {
  name: 'tasks_create',
  description: 'Create a new task.',
  schema: {
    title: z.string().min(1).describe('Task title'),
    description: z.string().optional().describe('Optional longer description'),
  },
  async handler({ title, description }, { broadcast }) {
    const task = await createTask({ title, description });
    broadcast('tasks.updated', { reason: 'created', task });
    return successResult({ task });
  },
};
