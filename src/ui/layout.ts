export function layout(title: string, page: 'tasks' | 'skills', body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Claude Manager</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0f1117;
      --surface: #1a1d27;
      --surface2: #22263a;
      --border: #2e3250;
      --accent: #7c6af7;
      --accent-dim: #4b44a8;
      --text: #e8eaf6;
      --text-dim: #8890b0;
      --todo: #3b82f6;
      --inprog: #f59e0b;
      --done: #22c55e;
      --danger: #ef4444;
      --radius: 10px;
      --nav-w: 220px;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      min-height: 100vh;
    }

    /* ── Sidebar ─────────────────────────────────────── */
    nav {
      width: var(--nav-w);
      min-height: 100vh;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      padding: 1.5rem 0;
      position: fixed;
      top: 0; left: 0;
    }

    .nav-logo {
      padding: 0 1.25rem 1.5rem;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--accent);
      letter-spacing: -0.02em;
      border-bottom: 1px solid var(--border);
      margin-bottom: 1rem;
    }
    .nav-logo span { color: var(--text-dim); font-weight: 400; }

    nav a {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.65rem 1.25rem;
      color: var(--text-dim);
      text-decoration: none;
      font-size: 0.95rem;
      border-radius: var(--radius);
      margin: 0.1rem 0.5rem;
      transition: background 0.15s, color 0.15s;
    }
    nav a:hover { background: var(--surface2); color: var(--text); }
    nav a.active { background: var(--accent-dim); color: #fff; font-weight: 600; }

    .nav-badge {
      margin-left: auto;
      background: var(--surface2);
      border-radius: 999px;
      font-size: 0.75rem;
      padding: 0.1rem 0.5rem;
      color: var(--text-dim);
    }
    nav a.active .nav-badge { background: rgba(255,255,255,0.15); color: #fff; }

    .nav-footer {
      margin-top: auto;
      padding: 1rem 1.25rem 0;
      border-top: 1px solid var(--border);
      font-size: 0.78rem;
      color: var(--text-dim);
      line-height: 1.6;
    }
    .nav-footer code {
      background: var(--surface2);
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      font-size: 0.74rem;
    }

    /* ── Main ────────────────────────────────────────── */
    main {
      margin-left: var(--nav-w);
      flex: 1;
      padding: 2rem;
      max-width: 1400px;
    }

    h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: 1.5rem; }
    h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.75rem; }

    /* ── Cards ───────────────────────────────────────── */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.25rem;
    }

    /* ── Forms ───────────────────────────────────────── */
    .form-row { display: flex; gap: 0.6rem; flex-wrap: wrap; }
    .form-grid { display: grid; gap: 0.6rem; }

    input, textarea, select {
      font: inherit;
      background: var(--surface2);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 6px;
      padding: 0.55rem 0.8rem;
      width: 100%;
      outline: none;
    }
    input:focus, textarea:focus, select:focus { border-color: var(--accent); }
    textarea { resize: vertical; min-height: 80px; }

    button {
      font: inherit;
      cursor: pointer;
      border: none;
      border-radius: 6px;
      padding: 0.55rem 1.1rem;
      font-weight: 600;
      transition: opacity 0.15s;
      white-space: nowrap;
    }
    button:hover { opacity: 0.85; }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-danger  { background: transparent; color: var(--danger); border: 1px solid var(--danger); padding: 0.3rem 0.7rem; font-size: 0.8rem; }
    .btn-sm      { padding: 0.3rem 0.7rem; font-size: 0.82rem; font-weight: 500; }

    /* ── Status badges ───────────────────────────────── */
    .badge {
      display: inline-block;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 0.2rem 0.6rem;
    }
    .badge-todo   { background: rgba(59,130,246,0.18); color: var(--todo); }
    .badge-in_progress { background: rgba(245,158,11,0.18); color: var(--inprog); }
    .badge-done   { background: rgba(34,197,94,0.18); color: var(--done); }

    /* ── Toast ───────────────────────────────────────── */
    #toast {
      position: fixed; bottom: 1.5rem; right: 1.5rem;
      background: var(--surface2); border: 1px solid var(--border);
      color: var(--text); border-radius: var(--radius);
      padding: 0.75rem 1.25rem; font-size: 0.9rem;
      opacity: 0; transition: opacity 0.25s;
      pointer-events: none; z-index: 999;
    }
    #toast.show { opacity: 1; }
  </style>
</head>
<body>
  <nav>
    <div class="nav-logo">Claude<span>Manager</span></div>
    <a href="/tasks" class="${page === 'tasks' ? 'active' : ''}">
      ✦ Tasks
      <span class="nav-badge" id="nav-task-count">—</span>
    </a>
    <a href="/skills" class="${page === 'skills' ? 'active' : ''}">
      ⚡ Skills
      <span class="nav-badge" id="nav-skill-count">—</span>
    </a>
    <div class="nav-footer">
      MCP endpoint<br/>
      <code>/mcp</code><br/>
      UI event stream<br/>
      <code>GET /events</code>
    </div>
  </nav>

  <main>${body}</main>

  <div id="toast"></div>

  <script>
    // ── SSE live-reload nav badge counts ─────────────────
    function updateBadges() {
      Promise.all([
        fetch('/api/tasks').then(r => r.json()),
        fetch('/api/skills').then(r => r.json()),
      ]).then(([td, sd]) => {
        const tc = document.getElementById('nav-task-count');
        const sc = document.getElementById('nav-skill-count');
        if (tc) tc.textContent = td.tasks?.length ?? '—';
        if (sc) sc.textContent = sd.skills?.length ?? '—';
      }).catch(() => {});
    }
    updateBadges();

    const sse = new EventSource('/events');
    sse.addEventListener('tasks.updated', () => { updateBadges(); onTasksUpdated(); });
    sse.addEventListener('skills.updated', () => { updateBadges(); onSkillsUpdated(); });

    function onTasksUpdated() {}
    function onSkillsUpdated() {}

    // ── Toast helper ──────────────────────────────────────
    function showToast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 2500);
    }

    // ── REST API helper ───────────────────────────────────
    async function api(method, path, body) {
      try {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body !== undefined) opts.body = JSON.stringify(body);
        const res = await fetch(path, opts);
        const json = await res.json();
        if (!res.ok) {
          showToast('Error: ' + (json.error ?? res.statusText));
          throw new Error(json.error ?? res.statusText);
        }
        return json;
      } catch (err) {
        if (!(err instanceof Error && err.message.startsWith('Error:'))) {
          showToast('Network error: ' + err.message);
        }
        throw err;
      }
    }
  </script>
</body>
</html>`;
}
