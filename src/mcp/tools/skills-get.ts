import { z } from 'zod';
import { getSkill } from '../../store.js';
import { McpToolDefinition, errorResult, successResult } from '../types.js';

export const skillsGetTool: McpToolDefinition<{ id: string }> = {
  name: 'skills_get',
  description: 'Get a single skill by id.',
  schema: { id: z.string().min(1) },
  async handler({ id }) {
    const skill = await getSkill(id);
    if (!skill) return errorResult(`skill not found: ${id}`);
    return successResult({ skill });
  },
};
