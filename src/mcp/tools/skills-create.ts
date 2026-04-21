import { z } from 'zod';
import { createSkill } from '../../store.js';
import { McpToolDefinition, successResult } from '../types.js';

type Params = {
  name: string;
  instructions: string;
  description?: string;
} & Record<string, unknown>;

export const skillsCreateTool: McpToolDefinition<Params> = {
  name: 'skills_create',
  description: 'Create a new skill. Instructions are stored as a markdown file under data/skills.',
  schema: {
    name: z.string().min(1),
    instructions: z.string().min(1),
    description: z.string().optional(),
  },
  async handler({ name, instructions, description }, { broadcast }) {
    const skill = await createSkill({ name, instructions, description });
    broadcast('skills.updated', { reason: 'created', skill });
    return successResult({ skill });
  },
};
