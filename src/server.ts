import express from 'express';
import { mountMcp } from './mcp/server.js';
import {
  createSkill,
  createTask,
  deleteSkill,
  deleteTask,
  ensureDataFiles,
  getSkill,
  getSkills,
  getTasks,
  updateSkill,
  updateTask,
  updateTaskStatus,
} from './store.js';
import { TaskStatus } from './types.js';
import { skillsPage } from './ui/skillsPage.js';
import { tasksPage } from './ui/tasksPage.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());

// ── UI broadcast SSE (separate from MCP) ─────────────────────────────────────

interface SseClient {
  sendEvent: (event: string, data: unknown) => void;
}

const sseClients = new Map<number, SseClient>();
let sseClientId = 0;

function broadcast(event: string, data: unknown): void {
  for (const client of sseClients.values()) {
    try { client.sendEvent(event, data); } catch { /* closed */ }
  }
}

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const id = ++sseClientId;
  sseClients.set(id, {
    sendEvent(event, data) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id })}\n\n`);

  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(id);
  });
});

// ── MCP (Streamable HTTP, session-per-initialize) ────────────────────────────

mountMcp(app, broadcast);

// ── REST API — Tasks ─────────────────────────────────────────────────────────

app.get('/api/tasks', async (_req, res) => {
  res.json({ tasks: await getTasks() });
});

app.post('/api/tasks', async (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  const description = req.body?.description ? String(req.body.description) : undefined;
  if (!title) { res.status(400).json({ error: 'title is required' }); return; }
  const task = await createTask({ title, description });
  broadcast('tasks.updated', { reason: 'created', task });
  res.status(201).json({ task });
});

app.patch('/api/tasks/:id', async (req, res) => {
  const patch: { title?: string; description?: string; status?: TaskStatus } = {};
  if (req.body?.title)       patch.title       = String(req.body.title).trim();
  if (req.body?.description) patch.description = String(req.body.description);
  if (req.body?.status)      patch.status      = String(req.body.status).trim() as TaskStatus;
  const task = await updateTask(req.params.id, patch);
  if (!task) { res.status(404).json({ error: 'task not found' }); return; }
  broadcast('tasks.updated', { reason: 'updated', task });
  res.json({ task });
});

app.patch('/api/tasks/:id/status', async (req, res) => {
  const status = String(req.body?.status ?? '').trim() as TaskStatus;
  if (!status) { res.status(400).json({ error: 'status is required' }); return; }
  const task = await updateTaskStatus(req.params.id, status);
  if (!task) { res.status(404).json({ error: 'task not found' }); return; }
  broadcast('tasks.updated', { reason: 'status_changed', task });
  res.json({ task });
});

app.delete('/api/tasks/:id', async (req, res) => {
  const ok = await deleteTask(req.params.id);
  if (!ok) { res.status(404).json({ error: 'task not found' }); return; }
  broadcast('tasks.updated', { reason: 'deleted', id: req.params.id });
  res.json({ ok: true });
});

// ── REST API — Skills ────────────────────────────────────────────────────────

app.get('/api/skills', async (_req, res) => {
  res.json({ skills: await getSkills() });
});

app.get('/api/skills/:id', async (req, res) => {
  const skill = await getSkill(req.params.id);
  if (!skill) { res.status(404).json({ error: 'skill not found' }); return; }
  res.json({ skill });
});

app.post('/api/skills', async (req, res) => {
  const name         = String(req.body?.name ?? '').trim();
  const instructions = String(req.body?.instructions ?? '').trim();
  const description  = req.body?.description ? String(req.body.description) : undefined;
  if (!name || !instructions) { res.status(400).json({ error: 'name and instructions are required' }); return; }
  const skill = await createSkill({ name, description, instructions });
  broadcast('skills.updated', { reason: 'created', skill });
  res.status(201).json({ skill });
});

app.patch('/api/skills/:id', async (req, res) => {
  const patch: { name?: string; description?: string; instructions?: string } = {};
  if (req.body?.name)         patch.name         = String(req.body.name).trim();
  if (req.body?.description)  patch.description  = String(req.body.description);
  if (req.body?.instructions) patch.instructions = String(req.body.instructions);
  const skill = await updateSkill(req.params.id, patch);
  if (!skill) { res.status(404).json({ error: 'skill not found' }); return; }
  broadcast('skills.updated', { reason: 'updated', skill });
  res.json({ skill });
});

app.delete('/api/skills/:id', async (req, res) => {
  const ok = await deleteSkill(req.params.id);
  if (!ok) { res.status(404).json({ error: 'skill not found' }); return; }
  broadcast('skills.updated', { reason: 'deleted', id: req.params.id });
  res.json({ ok: true });
});

// ── UI pages ─────────────────────────────────────────────────────────────────

app.get('/', (_req, res) => res.redirect('/tasks'));

app.get('/tasks', async (_req, res) => {
  const tasks = await getTasks();
  res.type('html').send(tasksPage(tasks));
});

app.get('/skills', async (_req, res) => {
  const skills = await getSkills();
  res.type('html').send(skillsPage(skills));
});

// ── Boot ─────────────────────────────────────────────────────────────────────

ensureDataFiles()
  .then(() => {
    app.listen(port, () => {
      console.log(`\n  Claude Manager running at http://localhost:${port}`);
      console.log(`  MCP (Streamable HTTP):  http://localhost:${port}/mcp`);
      console.log(`  UI event stream:        http://localhost:${port}/events\n`);
    });
  })
  .catch((err) => {
    console.error('Failed to start', err);
    process.exit(1);
  });
