import type { AnyMcpToolDefinition } from '../types.js';
import { skillsCreateTool } from './skills-create.js';
import { skillsDeleteTool } from './skills-delete.js';
import { skillsGetTool } from './skills-get.js';
import { skillsListTool } from './skills-list.js';
import { skillsUpdateTool } from './skills-update.js';
import { tasksCreateTool } from './tasks-create.js';
import { tasksDeleteTool } from './tasks-delete.js';
import { tasksGetTool } from './tasks-get.js';
import { tasksListTool } from './tasks-list.js';
import { tasksUpdateStatusTool } from './tasks-update-status.js';
import { tasksUpdateTool } from './tasks-update.js';

export const mcpTools: AnyMcpToolDefinition[] = [
  tasksListTool as AnyMcpToolDefinition,
  tasksGetTool as AnyMcpToolDefinition,
  tasksCreateTool as AnyMcpToolDefinition,
  tasksUpdateTool as AnyMcpToolDefinition,
  tasksUpdateStatusTool as AnyMcpToolDefinition,
  tasksDeleteTool as AnyMcpToolDefinition,
  skillsListTool as AnyMcpToolDefinition,
  skillsGetTool as AnyMcpToolDefinition,
  skillsCreateTool as AnyMcpToolDefinition,
  skillsUpdateTool as AnyMcpToolDefinition,
  skillsDeleteTool as AnyMcpToolDefinition,
];
