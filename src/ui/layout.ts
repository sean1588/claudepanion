import type { Companion } from '../types.js';

const DEV_MODE = process.env.NODE_ENV !== 'production';

export function layout(
  title: string,
  activeSlug: string,
  body: string,
  companions: Companion[],
): string {
  const navItems = companions
    .map((c) => {
      const active = c.slug === activeSlug ? 'active' : '';
      const icon = c.icon ?? '•';
      return `<a href="/c/${c.slug}" class="${active}"><span class="nav-icon">${icon}</span>${c.name}</a>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Claudepanion</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0f1117; --surface: #1a1d27; --surface2: #22263a;
      --border: #2e3250; --accent: #7c6af7; --accent-dim: #4b44a8;
      --text: #e8eaf6; --text-dim: #8890b0;
      --pending: #3b82f6; --running: #f59e0b; --done: #22c55e; --failed: #ef4444;
      --radius: 10px; --nav-w: 220px;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: var(--bg); color: var(--text); display: flex; min-height: 100vh; }
    nav { width: var(--nav-w); min-height: 100vh; background: var(--surface);
          border-right: 1px solid var(--border); display: flex; flex-direction: column;
          padding: 1.5rem 0; position: fixed; top: 0; left: 0; }
    .nav-logo { padding: 0 1.25rem 1.5rem; font-size: 1.1rem; font-weight: 700;
                color: var(--accent); letter-spacing: -0.02em;
                border-bottom: 1px solid var(--border); margin-bottom: 1rem; }
    .nav-logo span { color: var(--text-dim); font-weight: 400; }
    nav a { display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 1.25rem;
            color: var(--text-dim); text-decoration: none; font-size: 0.95rem;
            border-radius: var(--radius); margin: 0.1rem 0.5rem;
            transition: background 0.15s, color 0.15s; }
    nav a:hover { background: var(--surface2); color: var(--text); }
    nav a.active { background: var(--accent-dim); color: #fff; font-weight: 600; }
    .nav-icon { width: 1rem; text-align: center; }
    .nav-footer { margin-top: auto; padding: 1rem 1.25rem 0;
                  border-top: 1px solid var(--border); font-size: 0.78rem;
                  color: var(--text-dim); line-height: 1.6; }
    .nav-footer code { background: var(--surface2); padding: 0.1rem 0.35rem;
                       border-radius: 4px; font-size: 0.74rem; }
    main { margin-left: var(--nav-w); flex: 1; padding: 2rem; max-width: 1400px; }
    h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: 1rem; }
    h2 { font-size: 1.1rem; font-weight: 600; margin: 1.5rem 0 0.75rem; }
    textarea, input { font: inherit; background: var(--surface2); border: 1px solid var(--border);
                     color: var(--text); border-radius: 6px; padding: 0.55rem 0.8rem;
                     width: 100%; outline: none; }
    textarea { resize: vertical; min-height: 80px; }
    button { font: inherit; cursor: pointer; border: none; border-radius: 6px;
             padding: 0.55rem 1.1rem; font-weight: 600; transition: opacity 0.15s; }
    button:hover { opacity: 0.85; }
    .btn-primary { background: var(--accent); color: #fff; }
    .badge { display: inline-block; border-radius: 999px; font-size: 0.72rem;
             font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
             padding: 0.2rem 0.6rem; }
    .badge-pending  { background: rgba(59,130,246,0.18); color: var(--pending); }
    .badge-running  { background: rgba(245,158,11,0.18); color: var(--running); }
    .badge-done     { background: rgba(34,197,94,0.18); color: var(--done); }
    .badge-failed   { background: rgba(239,68,68,0.18); color: var(--failed); }
    .request { background: var(--surface); border: 1px solid var(--border);
               border-radius: var(--radius); padding: 1rem; margin-bottom: 0.8rem; }
    .request header { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }
    .desc { font-weight: 600; margin-bottom: 0.5rem; }
    .logs { font-family: 'SF Mono', Menlo, monospace; font-size: 0.82rem;
            color: var(--text-dim); background: var(--surface2);
            border-radius: 6px; padding: 0.5rem; margin: 0.5rem 0; }
    .log-line { margin: 0.15rem 0; }
    .log-at { color: var(--accent-dim); margin-right: 0.5rem; }
    .md { font-size: 0.95rem; line-height: 1.6; margin-top: 0.5rem; }
    .error { color: var(--failed); margin-top: 0.5rem; }
    .empty { color: var(--text-dim); font-style: italic; }
    .dim { color: var(--text-dim); }
    .intro { color: var(--text-dim); font-size: 0.88rem; margin-bottom: 1rem; }
    form label { display: block; font-size: 0.88rem; color: var(--text-dim); margin-bottom: 0.3rem; }
    form { margin-bottom: 2rem; }
    form button { margin-top: 0.6rem; }
    #toast { position: fixed; bottom: 1.5rem; right: 1.5rem; background: var(--surface2);
             border: 1px solid var(--border); color: var(--text); border-radius: var(--radius);
             padding: 0.75rem 1.25rem; font-size: 0.9rem; opacity: 0; transition: opacity 0.25s;
             pointer-events: none; z-index: 999; }
    #toast.show { opacity: 1; }
  </style>
</head>
<body>
  <nav>
    <div class="nav-logo">Claude<span>panion</span></div>
    ${navItems || '<p class="empty" style="padding:0 1.25rem">No companions.</p>'}
    <div class="nav-footer">
      MCP endpoint<br/><code>/mcp</code><br/>
      Event stream<br/><code>GET /events</code>
      ${DEV_MODE ? '<br/><span style="color:var(--running)">DEV MODE</span>' : ''}
    </div>
  </nav>
  <main>${body}</main>
  <div id="toast"></div>
  <script>
    const sse = new EventSource('/events');
    function showToast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 2500);
    }
    async function api(method, path, body) {
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (body !== undefined) opts.body = JSON.stringify(body);
      const res = await fetch(path, opts);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast('Error: ' + (json.error ?? res.statusText));
        throw new Error(json.error ?? res.statusText);
      }
      return json;
    }
  </script>
</body>
</html>`;
}
