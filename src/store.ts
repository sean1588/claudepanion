import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Skill, Task, TaskStatus } from './types.js';

// ── Paths ────────────────────────────────────────────────────────────────────

const dataDir        = path.resolve(process.cwd(), 'data');
const skillsDir      = path.join(dataDir, 'skills');
const legacySkillsDir = path.resolve(process.cwd(), 'skills');
const tasksPath      = path.join(dataDir, 'tasks.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

async function writeJsonFile<T>(filePath: string, value: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf-8');
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Skill markdown serialisation ─────────────────────────────────────────────
//
// Each skill is stored as  skills/<slug>.md  with the shape:
//
//   ---
//   id: skill-abc123
//   name: My Skill
//   description: Optional one-liner
//   createdAt: 2024-01-01T00:00:00.000Z
//   updatedAt: 2024-01-01T00:00:00.000Z
//   ---
//
//   <instruction markdown body>
//

function serializeSkill(skill: Skill): string {
  const lines = [
    '---',
    `id: ${skill.id}`,
    `name: ${skill.name}`,
  ];
  if (skill.description) lines.push(`description: ${skill.description}`);
  lines.push(`createdAt: ${skill.createdAt}`);
  lines.push(`updatedAt: ${skill.updatedAt}`);
  lines.push('---', '', skill.instructions);
  return lines.join('\n');
}

function parseSkillFile(slug: string, content: string): Skill {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`Invalid skill file: ${slug}.md`);

  const frontmatter = match[1];
  const instructions = match[2].trim();

  function fm(key: string): string {
    const m = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return m ? m[1].trim() : '';
  }

  return {
    id:           fm('id') || createId('skill'),
    slug,
    name:         fm('name') || slug,
    description:  fm('description') || undefined,
    instructions,
    createdAt:    fm('createdAt') || new Date().toISOString(),
    updatedAt:    fm('updatedAt') || new Date().toISOString(),
  };
}

function skillPath(slug: string): string {
  return path.join(skillsDir, `${slug}.md`);
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function getTasks(): Promise<Task[]> {
  return readJsonFile<Task[]>(tasksPath);
}

export async function getTask(id: string): Promise<Task | null> {
  const tasks = await getTasks();
  return tasks.find((t) => t.id === id) ?? null;
}

export async function createTask(input: { title: string; description?: string }): Promise<Task> {
  const tasks = await getTasks();
  const now = new Date().toISOString();
  const task: Task = {
    id: createId('task'),
    title: input.title,
    description: input.description,
    status: 'todo',
    createdAt: now,
    updatedAt: now,
  };
  tasks.push(task);
  await writeJsonFile(tasksPath, tasks);
  return task;
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, 'title' | 'description' | 'status'>>,
): Promise<Task | null> {
  const tasks = await getTasks();
  const task = tasks.find((t) => t.id === id);
  if (!task) return null;
  if (patch.title       !== undefined) task.title       = patch.title;
  if (patch.description !== undefined) task.description = patch.description;
  if (patch.status      !== undefined) task.status      = patch.status;
  task.updatedAt = new Date().toISOString();
  await writeJsonFile(tasksPath, tasks);
  return task;
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task | null> {
  return updateTask(id, { status });
}

export async function deleteTask(id: string): Promise<boolean> {
  const tasks = await getTasks();
  const next = tasks.filter((t) => t.id !== id);
  if (next.length === tasks.length) return false;
  await writeJsonFile(tasksPath, next);
  return true;
}

// ── Skills ───────────────────────────────────────────────────────────────────

export async function getSkills(): Promise<Skill[]> {
  const entries = await fs.readdir(skillsDir);
  const mdFiles = entries.filter((f) => f.endsWith('.md'));
  const skills = await Promise.all(
    mdFiles.map(async (file) => {
      const slug    = file.replace(/\.md$/, '');
      const content = await fs.readFile(skillPath(slug), 'utf-8');
      return parseSkillFile(slug, content);
    }),
  );
  return skills.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getSkill(id: string): Promise<Skill | null> {
  const skills = await getSkills();
  return skills.find((s) => s.id === id) ?? null;
}

export async function getSkillBySlug(slug: string): Promise<Skill | null> {
  try {
    const content = await fs.readFile(skillPath(slug), 'utf-8');
    return parseSkillFile(slug, content);
  } catch {
    return null;
  }
}

export async function createSkill(input: {
  name: string;
  description?: string;
  instructions: string;
}): Promise<Skill> {
  const now  = new Date().toISOString();
  const baseSlug = toSlug(input.name) || createId('skill');

  // ensure unique slug
  let slug = baseSlug;
  let counter = 2;
  while (await getSkillBySlug(slug)) {
    slug = `${baseSlug}-${counter++}`;
  }

  const skill: Skill = {
    id:           createId('skill'),
    slug,
    name:         input.name,
    description:  input.description,
    instructions: input.instructions,
    createdAt:    now,
    updatedAt:    now,
  };

  await fs.writeFile(skillPath(slug), serializeSkill(skill), 'utf-8');
  return skill;
}

export async function updateSkill(
  id: string,
  patch: Partial<Pick<Skill, 'name' | 'description' | 'instructions'>>,
): Promise<Skill | null> {
  const skill = await getSkill(id);
  if (!skill) return null;

  const oldSlug = skill.slug;
  const updated: Skill = {
    ...skill,
    name:         patch.name         ?? skill.name,
    description:  patch.description  ?? skill.description,
    instructions: patch.instructions ?? skill.instructions,
    updatedAt:    new Date().toISOString(),
  };

  // if name changed, derive a new slug and rename the file
  if (patch.name && patch.name !== skill.name) {
    const baseSlug = toSlug(patch.name) || oldSlug;
    let newSlug = baseSlug;
    let counter = 2;
    while (newSlug !== oldSlug && await getSkillBySlug(newSlug)) {
      newSlug = `${baseSlug}-${counter++}`;
    }
    updated.slug = newSlug;
    await fs.rename(skillPath(oldSlug), skillPath(newSlug));
  }

  await fs.writeFile(skillPath(updated.slug), serializeSkill(updated), 'utf-8');
  return updated;
}

export async function deleteSkill(id: string): Promise<boolean> {
  const skill = await getSkill(id);
  if (!skill) return false;
  await fs.unlink(skillPath(skill.slug));
  return true;
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

const legacySkillsPath = path.join(dataDir, 'skills.json');

/** Migrate any skills that were stored in the old skills.json into .md files. */
async function migrateSkillsJson(): Promise<void> {
  try {
    await fs.access(legacySkillsPath);
  } catch {
    return; // nothing to migrate
  }

  interface LegacySkill {
    id: string;
    name: string;
    description?: string;
    instructions: string;
    createdAt: string;
    updatedAt: string;
  }

  const legacy = await readJsonFile<LegacySkill[]>(legacySkillsPath);
  if (!Array.isArray(legacy) || legacy.length === 0) {
    await fs.unlink(legacySkillsPath).catch(() => null);
    return;
  }

  for (const s of legacy) {
    const baseSlug = toSlug(s.name) || s.id;
    let slug = baseSlug;
    let counter = 2;
    // Don't overwrite an .md that may already have been migrated
    while (true) {
      try {
        await fs.access(skillPath(slug));
        slug = `${baseSlug}-${counter++}`;
      } catch {
        break;
      }
    }

    const skill: Skill = {
      id:           s.id,
      slug,
      name:         s.name,
      description:  s.description,
      instructions: s.instructions,
      createdAt:    s.createdAt,
      updatedAt:    s.updatedAt,
    };
    await fs.writeFile(skillPath(slug), serializeSkill(skill), 'utf-8');
  }

  // Rename the old file so we don't migrate twice
  await fs.rename(legacySkillsPath, legacySkillsPath + '.migrated').catch(() => null);
}

/**
 * Migrate any user-authored skill .md files from the old top-level `skills/`
 * directory into `data/skills/`. Subdirectories (plugin-bundled skills) are
 * left in place.
 */
async function migrateFlatSkillsDir(): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(legacySkillsDir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (!name.endsWith('.md')) continue;
    const from = path.join(legacySkillsDir, name);
    const to   = path.join(skillsDir, name);
    try { await fs.access(to); continue; } catch { /* doesn't exist → move */ }
    try { await fs.rename(from, to); } catch { /* ignore */ }
  }
}

export async function ensureDataFiles(): Promise<void> {
  await fs.mkdir(dataDir,   { recursive: true });
  await fs.mkdir(skillsDir, { recursive: true });
  try { await fs.access(tasksPath); } catch { await writeJsonFile(tasksPath, []); }
  await migrateSkillsJson();
  await migrateFlatSkillsDir();
}
