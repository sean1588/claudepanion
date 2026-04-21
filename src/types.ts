export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  slug: string;       // filename stem, e.g. "code-review" → skills/code-review.md
  name: string;
  description?: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
}
