import { z } from 'zod';
import { updateSkill } from '../../store.js';
import { McpToolDefinition, errorResult, successResult } from '../types.js';

type Params = {
  id: string;
  name?: string;
  description?: string;
  instructions?: string;
} & Record<string, unknown>;

export const skillsUpdateTool: McpToolDefinition<Params> = {
  name: 'skills_update',
  description: 'Update a skill. Any of name, description, or instructions may be supplied.',
  schema: {
    id: z.string().min(1),
    name: z.string().optional(),
    description: z.string().optional(),
    instructions: z.string().optional(),
  },
  async handler({ id, ...patch }, { broadcast }) {
    const skill = await updateSkill(id, patch);
    if (!skill) return errorResult(`skill not found: ${id}`);
    broadcast('skills.updated', { reason: 'updated', skill });
    return successResult({ skill });
  },
};
