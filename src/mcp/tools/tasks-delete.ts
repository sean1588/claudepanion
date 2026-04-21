import { z } from 'zod';
import { deleteTask } from '../../store.js';
import { McpToolDefinition, errorResult, successResult } from '../types.js';

export const tasksDeleteTool: McpToolDefinition<{ id: string }> = {
  name: 'tasks_delete',
  description: 'Delete a task by id.',
  schema: { id: z.string().min(1) },
  async handler({ id }, { broadcast }) {
    const ok = await deleteTask(id);
    if (!ok) return errorResult(`task not found: ${id}`);
    broadcast('tasks.updated', { reason: 'deleted', id });
    return successResult({ ok: true });
  },
};
