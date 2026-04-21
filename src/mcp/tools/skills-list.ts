import { getSkills } from '../../store.js';
import { McpToolDefinition, successResult } from '../types.js';

export const skillsListTool: McpToolDefinition<Record<string, never>> = {
  name: 'skills_list',
  description: 'List all user-authored skills.',
  schema: {},
  async handler() {
    return successResult({ skills: await getSkills() });
  },
};
