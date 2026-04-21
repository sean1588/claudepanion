import { Skill } from '../types.js';
import { layout } from './layout.js';

function escapeHtml(v: string): string {
  return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function skillCard(skill: Skill): string {
  return `
    <div class="skill-card" id="skill-${escapeHtml(skill.id)}" data-id="${escapeHtml(skill.id)}">
      <div class="skill-card-header">
        <div class="skill-name">${escapeHtml(skill.name)}</div>
        <div class="skill-actions">
          <button class="btn-sm skill-edit" data-id="${escapeHtml(skill.id)}">Edit</button>
          <button class="btn-danger btn-sm skill-delete" data-id="${escapeHtml(skill.id)}">✕</button>
        </div>
      </div>
      ${skill.description ? `<div class="skill-desc">${escapeHtml(skill.description)}</div>` : ''}
      <div class="skill-instructions-label">Instructions</div>
      <pre class="skill-instructions">${escapeHtml(skill.instructions)}</pre>
      <div class="skill-meta">Updated ${new Date(skill.updatedAt).toLocaleDateString()}</div>
    </div>`;
}

export function skillsPage(skills: Skill[]): string {
  const cards = skills.map(skillCard).join('') || '<p class="empty-msg">No skills yet. Add one below.</p>';

  const body = `
    <h1>Skills</h1>
    <p class="page-desc">Skills are reusable instruction sets Claude will follow when working on tasks.</p>

    <div class="skills-grid" id="skills-grid">
      ${cards}
    </div>

    <div class="card" style="margin-top:1.5rem" id="skill-form-card">
      <h2 id="skill-form-title">Add skill</h2>
      <div class="form-grid">
        <input id="skill-name" placeholder="Skill name" />
        <input id="skill-description" placeholder="Description (optional)" />
        <textarea id="skill-instructions" placeholder="Instructions Claude should follow when using this skill" style="min-height:120px"></textarea>
        <div class="form-row">
          <button class="btn-primary" id="save-skill-btn">Add skill</button>
          <button id="cancel-edit-btn" style="display:none;background:var(--surface2);color:var(--text-dim)">Cancel</button>
        </div>
      </div>
    </div>

    <style>
      .page-desc { color: var(--text-dim); margin-bottom: 1.5rem; font-size: 0.92rem; }
      .empty-msg { color: var(--text-dim); padding: 1rem 0; }

      .skills-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
        gap: 1.25rem;
      }

      .skill-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1.2rem;
        display: flex; flex-direction: column; gap: 0.5rem;
        transition: border-color 0.15s;
      }
      .skill-card:hover { border-color: var(--accent); }

      .skill-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; }
      .skill-name { font-weight: 700; font-size: 1rem; }
      .skill-desc { font-size: 0.85rem; color: var(--text-dim); }
      .skill-actions { display: flex; gap: 0.4rem; flex-shrink: 0; }
      .skill-actions .btn-sm {
        background: var(--surface2); color: var(--text-dim);
        border: 1px solid var(--border); font-size: 0.78rem; padding: 0.25rem 0.6rem; border-radius: 5px;
      }
      .skill-actions .btn-sm:hover { color: var(--text); border-color: var(--accent); }

      .skill-instructions-label { font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.06em; }
      .skill-instructions {
        white-space: pre-wrap; word-break: break-word;
        background: var(--surface2); border: 1px solid var(--border);
        border-radius: 6px; padding: 0.75rem; font-size: 0.84rem;
        font-family: inherit; color: var(--text);
        max-height: 200px; overflow-y: auto;
      }
      .skill-meta { font-size: 0.75rem; color: var(--text-dim); }
    </style>

    <script>
      let editingId = null;

      // ── Save (add or update) ──────────────────────────
      document.getElementById('save-skill-btn').addEventListener('click', async () => {
        const name         = document.getElementById('skill-name').value.trim();
        const description  = document.getElementById('skill-description').value.trim() || undefined;
        const instructions = document.getElementById('skill-instructions').value.trim();
        if (!name || !instructions) {
          showToast('Name and instructions are required');
          return;
        }
        try {
          if (editingId) {
            await api('PATCH', '/api/skills/' + editingId, { name, description, instructions });
            showToast('Skill updated');
            cancelEdit();
          } else {
            await api('POST', '/api/skills', { name, description, instructions });
            showToast('Skill added');
            clearForm();
          }
          refreshSkills();
        } catch { /* error already shown by api() */ }
      });

      // ── Edit button ───────────────────────────────────
      document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.skill-edit');
        if (!btn) return;
        try {
          const { skill } = await api('GET', '/api/skills/' + btn.dataset.id);
          editingId = skill.id;
          document.getElementById('skill-name').value         = skill.name;
          document.getElementById('skill-description').value  = skill.description ?? '';
          document.getElementById('skill-instructions').value = skill.instructions;
          document.getElementById('skill-form-title').textContent = 'Edit skill';
          document.getElementById('save-skill-btn').textContent   = 'Save changes';
          document.getElementById('cancel-edit-btn').style.display = '';
          document.getElementById('skill-form-card').scrollIntoView({ behavior: 'smooth' });
        } catch { /* error already shown by api() */ }
      });

      // ── Delete button ─────────────────────────────────
      document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.skill-delete');
        if (!btn) return;
        if (!confirm('Delete this skill?')) return;
        try {
          await api('DELETE', '/api/skills/' + btn.dataset.id);
          showToast('Skill deleted');
          refreshSkills();
        } catch { /* error already shown by api() */ }
      });

      // ── Cancel edit ───────────────────────────────────
      document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);

      function cancelEdit() {
        editingId = null;
        clearForm();
        document.getElementById('skill-form-title').textContent     = 'Add skill';
        document.getElementById('save-skill-btn').textContent       = 'Add skill';
        document.getElementById('cancel-edit-btn').style.display    = 'none';
      }

      function clearForm() {
        document.getElementById('skill-name').value         = '';
        document.getElementById('skill-description').value  = '';
        document.getElementById('skill-instructions').value = '';
      }

      // ── Refresh grid in-place ─────────────────────────
      async function refreshSkills() {
        const { skills } = await api('GET', '/api/skills');
        const grid = document.getElementById('skills-grid');
        grid.innerHTML = skills.length ? skills.map(skillHtml).join('') : '<p class="empty-msg">No skills yet. Add one below.</p>';
      }

      function esc(v) {
        return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
      }

      function skillHtml(s) {
        return '<div class="skill-card" id="skill-'+esc(s.id)+'" data-id="'+esc(s.id)+'">'
          + '<div class="skill-card-header">'
          + '<div class="skill-name">'+esc(s.name)+'</div>'
          + '<div class="skill-actions">'
          + '<button class="btn-sm skill-edit" data-id="'+esc(s.id)+'">Edit</button>'
          + '<button class="btn-danger btn-sm skill-delete" data-id="'+esc(s.id)+'">✕</button>'
          + '</div></div>'
          + (s.description ? '<div class="skill-desc">'+esc(s.description)+'</div>' : '')
          + '<div class="skill-instructions-label">Instructions</div>'
          + '<pre class="skill-instructions">'+esc(s.instructions)+'</pre>'
          + '<div class="skill-meta">Updated '+new Date(s.updatedAt).toLocaleDateString()+'</div>'
          + '</div>';
      }

      // ── SSE live reload ───────────────────────────────
      function onSkillsUpdated() { refreshSkills(); }
    </script>`;

  return layout('Skills', 'skills', body);
}
