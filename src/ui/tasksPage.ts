import { Task } from '../types.js';
import { layout } from './layout.js';

function escapeHtml(v: string): string {
  return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function taskCard(task: Task): string {
  return `
    <div class="task-card" id="task-${escapeHtml(task.id)}" data-id="${escapeHtml(task.id)}" data-status="${escapeHtml(task.status)}">
      <div class="task-card-header">
        <span class="badge badge-${escapeHtml(task.status)}">${escapeHtml(task.status.replace('_', ' '))}</span>
        <button class="btn-danger btn-sm task-delete" data-id="${escapeHtml(task.id)}" title="Delete task">✕</button>
      </div>
      <div class="task-title">${escapeHtml(task.title)}</div>
      ${task.description ? `<div class="task-desc">${escapeHtml(task.description)}</div>` : ''}
      <div class="task-meta">Created ${new Date(task.createdAt).toLocaleDateString()}</div>
      <div class="task-actions">
        ${task.status !== 'todo'       ? `<button class="btn-sm task-move" data-id="${escapeHtml(task.id)}" data-status="todo">← Todo</button>` : ''}
        ${task.status !== 'in_progress' ? `<button class="btn-sm task-move" data-id="${escapeHtml(task.id)}" data-status="in_progress">▶ In Progress</button>` : ''}
        ${task.status !== 'done'       ? `<button class="btn-sm task-move" data-id="${escapeHtml(task.id)}" data-status="done">✔ Done</button>` : ''}
      </div>
    </div>`;
}

function column(status: string, label: string, colorVar: string, tasks: Task[]): string {
  const cards = tasks.filter((t) => t.status === status).map(taskCard).join('') || '<div class="col-empty">No tasks</div>';
  return `
    <div class="kanban-col" data-col="${status}">
      <div class="col-header" style="border-color:${colorVar}">
        <span>${label}</span>
        <span class="col-count">${tasks.filter((t) => t.status === status).length}</span>
      </div>
      <div class="col-body" id="col-${status}">${cards}</div>
    </div>`;
}

export function tasksPage(tasks: Task[]): string {
  const body = `
    <h1>Tasks</h1>

    <div class="card" style="margin-bottom:1.5rem">
      <h2>Add task</h2>
      <div class="form-row" id="add-task-form">
        <input id="task-title" placeholder="Task title" style="flex:2;min-width:160px" />
        <input id="task-desc"  placeholder="Description (optional)" style="flex:3;min-width:200px" />
        <button class="btn-primary" id="add-task-btn">Add task</button>
      </div>
    </div>

    <div class="kanban" id="kanban">
      ${column('todo', 'Todo', 'var(--todo)', tasks)}
      ${column('in_progress', 'In Progress', 'var(--inprog)', tasks)}
      ${column('done', 'Done', 'var(--done)', tasks)}
    </div>

    <style>
      .kanban {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.25rem;
        align-items: start;
      }
      @media (max-width: 900px) { .kanban { grid-template-columns: 1fr; } }

      .kanban-col { display: flex; flex-direction: column; gap: 0.75rem; }

      .col-header {
        display: flex; justify-content: space-between; align-items: center;
        font-weight: 700; font-size: 0.9rem; text-transform: uppercase;
        letter-spacing: 0.06em; padding-bottom: 0.6rem;
        border-bottom: 2px solid;
      }
      .col-count {
        background: var(--surface2);
        border-radius: 999px;
        font-size: 0.78rem;
        padding: 0.1rem 0.55rem;
        color: var(--text-dim);
        font-weight: 500;
      }
      .col-body { display: flex; flex-direction: column; gap: 0.75rem; min-height: 80px; }
      .col-empty { color: var(--text-dim); font-size: 0.85rem; padding: 0.5rem 0; }

      .task-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1rem;
        display: flex; flex-direction: column; gap: 0.45rem;
        transition: border-color 0.15s;
      }
      .task-card:hover { border-color: var(--accent); }

      .task-card-header { display: flex; justify-content: space-between; align-items: center; }
      .task-title { font-weight: 600; font-size: 0.97rem; }
      .task-desc  { font-size: 0.84rem; color: var(--text-dim); }
      .task-meta  { font-size: 0.75rem; color: var(--text-dim); }
      .task-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.25rem; }
      .task-actions button {
        background: var(--surface2);
        color: var(--text-dim);
        border: 1px solid var(--border);
        font-size: 0.78rem;
        padding: 0.25rem 0.6rem;
        border-radius: 5px;
      }
      .task-actions button:hover { color: var(--text); border-color: var(--accent); }
    </style>

    <script>
      // ── Add task ──────────────────────────────────────
      document.getElementById('add-task-btn').addEventListener('click', async () => {
        const titleEl = document.getElementById('task-title');
        const descEl  = document.getElementById('task-desc');
        const title = titleEl.value.trim();
        if (!title) { titleEl.focus(); return; }
        try {
          await api('POST', '/api/tasks', { title, description: descEl.value.trim() || undefined });
          titleEl.value = '';
          descEl.value  = '';
          showToast('Task added');
          refreshKanban();
        } catch { /* error already shown by api() */ }
      });

      // ── Move task ─────────────────────────────────────
      document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.task-move');
        if (!btn) return;
        try {
          await api('PATCH', '/api/tasks/' + btn.dataset.id + '/status', { status: btn.dataset.status });
          showToast('Status updated');
          refreshKanban();
        } catch { /* error already shown by api() */ }
      });

      // ── Delete task ───────────────────────────────────
      document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.task-delete');
        if (!btn) return;
        if (!confirm('Delete this task?')) return;
        try {
          await api('DELETE', '/api/tasks/' + btn.dataset.id);
          showToast('Task deleted');
          refreshKanban();
        } catch { /* error already shown by api() */ }
      });

      // ── Refresh kanban in-place ───────────────────────
      async function refreshKanban() {
        const { tasks } = await api('GET', '/api/tasks');
        renderKanban(tasks);
      }

      function renderKanban(tasks) {
        const statuses = ['todo', 'in_progress', 'done'];
        statuses.forEach(status => {
          const col = document.getElementById('col-' + status);
          if (!col) return;
          const filtered = tasks.filter(t => t.status === status);
          col.innerHTML = filtered.length
            ? filtered.map(t => cardHtml(t)).join('')
            : '<div class="col-empty">No tasks</div>';

          // update count badge
          const header = col.closest('.kanban-col').querySelector('.col-count');
          if (header) header.textContent = filtered.length;
        });
      }

      function esc(v) {
        return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
      }

      function cardHtml(t) {
        const moveButtons = [];
        if (t.status !== 'todo')        moveButtons.push('<button class="btn-sm task-move" data-id="'+esc(t.id)+'" data-status="todo">← Todo</button>');
        if (t.status !== 'in_progress') moveButtons.push('<button class="btn-sm task-move" data-id="'+esc(t.id)+'" data-status="in_progress">▶ In Progress</button>');
        if (t.status !== 'done')        moveButtons.push('<button class="btn-sm task-move" data-id="'+esc(t.id)+'" data-status="done">✔ Done</button>');
        return '<div class="task-card" id="task-'+esc(t.id)+'" data-id="'+esc(t.id)+'" data-status="'+esc(t.status)+'">'
          + '<div class="task-card-header">'
          + '<span class="badge badge-'+esc(t.status)+'">'+esc(t.status.replace('_',' '))+'</span>'
          + '<button class="btn-danger btn-sm task-delete" data-id="'+esc(t.id)+'" title="Delete">✕</button>'
          + '</div>'
          + '<div class="task-title">'+esc(t.title)+'</div>'
          + (t.description ? '<div class="task-desc">'+esc(t.description)+'</div>' : '')
          + '<div class="task-meta">Created '+new Date(t.createdAt).toLocaleDateString()+'</div>'
          + '<div class="task-actions">'+moveButtons.join('')+'</div>'
          + '</div>';
      }

      // ── SSE live reload ───────────────────────────────
      function onTasksUpdated() { refreshKanban(); }

      // ── Enter key on title input ──────────────────────
      document.getElementById('task-title').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('add-task-btn').click();
      });
    </script>`;

  return layout('Tasks', 'tasks', body);
}
