import { z } from 'zod';
import { updateTask } from '../../store.js';
import { TaskStatus } from '../../types.js';
import { McpToolDefinition, errorResult, successResult } from '../types.js';

type Params = {
  id: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
} & Record<string, unknown>;

export const tasksUpdateTool: McpToolDefinition<Params> = {
  name: 'tasks_update',
  description: 'Update a task. Any of title, description, or status may be supplied.',
  schema: {
    id: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['todo', 'in_progress', 'done']).optional(),
  },
  async handler({ id, ...patch }, { broadcast }) {
    const task = await updateTask(id, patch);
    if (!task) return errorResult(`task not found: ${id}`);
    broadcast('tasks.updated', { reason: 'updated', task });
    return successResult({ task });
  },
};
