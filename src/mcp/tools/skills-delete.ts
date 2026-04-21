import { z } from 'zod';
import { deleteSkill } from '../../store.js';
import { McpToolDefinition, errorResult, successResult } from '../types.js';

export const skillsDeleteTool: McpToolDefinition<{ id: string }> = {
  name: 'skills_delete',
  description: 'Delete a skill by id.',
  schema: { id: z.string().min(1) },
  async handler({ id }, { broadcast }) {
    const ok = await deleteSkill(id);
    if (!ok) return errorResult(`skill not found: ${id}`);
    broadcast('skills.updated', { reason: 'deleted', id });
    return successResult({ ok: true });
  },
};
