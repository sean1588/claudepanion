import type { CompanionContext } from '../../src/types.js';
import { store } from './store.js';

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusBadge(status: string): string {
  return `<span class="badge badge-${status}">${status}</span>`;
}

function renderRequest(r: {
  id: string;
  status: string;
  description: string;
  createdAt: string;
  logs: Array<{ at: string; message: string }>;
  result: { summary: string; files: Array<{ path: string; bytes: number }> } | null;
  error: string | null;
}): string {
  const logs = r.logs
    .map((l) => `<div class="log-line"><span class="log-at">${escape(l.at)}</span> ${escape(l.message)}</div>`)
    .join('');
  const files = r.result?.files
    ? `<details><summary>Files (${r.result.files.length})</summary><ul>${r.result.files
        .map((f) => `<li><code>${escape(f.path)}</code> <span class="dim">(${f.bytes}b)</span></li>`)
        .join('')}</ul></details>`
    : '';
  const summary = r.result?.summary
    ? `<div class="md">${escape(r.result.summary).replace(/\n/g, '<br/>')}</div>`
    : '';
  const err = r.error ? `<div class="error">${escape(r.error)}</div>` : '';
  return `
    <article class="request" data-id="${escape(r.id)}" data-status="${escape(r.status)}">
      <header>${statusBadge(r.status)} <span class="dim">${escape(r.createdAt)}</span></header>
      <p class="desc">${escape(r.description)}</p>
      <div class="logs">${logs}</div>
      ${summary}
      ${files}
      ${err}
    </article>
  `;
}

export async function renderPage(_ctx: CompanionContext): Promise<string> {
  const requests = await store.list();
  const sorted = [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const listHtml = sorted.length
    ? sorted.map(renderRequest).join('')
    : `<p class="empty">No requests yet. Describe a companion to scaffold and Claude Code will pick it up.</p>`;

  return `
    <section class="build-page">
      <h1>Build</h1>
      <p class="intro">Claudepanion works by having Claude Code (in this repo) pick up work you submit here. Make sure a Claude Code session is running with claudepanion enabled.</p>
      <form id="build-form">
        <label for="desc">Describe a companion to scaffold</label>
        <textarea id="desc" name="description" rows="4" placeholder="A companion that reads a URL and produces a markdown summary."></textarea>
        <button type="submit" class="btn-primary">Submit</button>
      </form>
      <h2>Requests</h2>
      <div id="build-list">${listHtml}</div>
    </section>
    <script>
      (function () {
        const form = document.getElementById('build-form');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const desc = document.getElementById('desc').value.trim();
          if (!desc) return;
          await api('POST', '/api/c/build/requests', { description: desc });
          document.getElementById('desc').value = '';
          showToast('Request submitted');
        });
        sse.addEventListener('build.request_created', () => location.reload());
        sse.addEventListener('build.request_updated', () => location.reload());
        sse.addEventListener('build.log_appended', (e) => {
          const { id, message, at } = JSON.parse(e.data);
          const card = document.querySelector('article.request[data-id="' + id + '"] .logs');
          if (card) {
            const el = document.createElement('div');
            el.className = 'log-line';
            el.innerHTML = '<span class="log-at"></span> <span class="msg"></span>';
            el.querySelector('.log-at').textContent = at;
            el.querySelector('.msg').textContent = message;
            card.appendChild(el);
          }
        });
      })();
    </script>
  `;
}
