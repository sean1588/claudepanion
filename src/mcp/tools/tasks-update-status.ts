import { z } from 'zod';
import { updateTaskStatus } from '../../store.js';
import { TaskStatus } from '../../types.js';
import { McpToolDefinition, errorResult, successResult } from '../types.js';

export const tasksUpdateStatusTool: McpToolDefinition<{ id: string; status: TaskStatus }> = {
  name: 'tasks_update_status',
  description: 'Update only the status of a task.',
  schema: {
    id: z.string().min(1),
    status: z.enum(['todo', 'in_progress', 'done']),
  },
  async handler({ id, status }, { broadcast }) {
    const task = await updateTaskStatus(id, status);
    if (!task) return errorResult(`task not found: ${id}`);
    broadcast('tasks.updated', { reason: 'status_changed', task });
    return successResult({ task });
  },
};
