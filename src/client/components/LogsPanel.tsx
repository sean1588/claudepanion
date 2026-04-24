import type { LogEntry } from "@shared/types";

export default function LogsPanel({ logs, waiting, polling }: { logs: LogEntry[]; waiting?: boolean; polling?: boolean }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <span>Logs {polling && <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>· polling every 2s</span>}</span>
        <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>{logs.length} entries</span>
      </div>
      {logs.length === 0 && waiting ? (
        <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          Waiting for Claude to start…
          <br />
          <span style={{ fontSize: 12 }}>Logs appear here once the slash command is run.</span>
        </div>
      ) : (
        <div className="logs">
          {logs.map((l, i) => (
            <div key={i}>
              <span className="log-ts">{l.timestamp.slice(11, 19)}</span>{" "}
              <span className={`log-level-${l.level}`}>{l.level}</span>{" "}
              {l.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
