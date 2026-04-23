import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import type { Entity, Manifest } from "@shared/types";
import { fetchCompanions, fetchEntities } from "../api";
import StatusPill from "../components/StatusPill";
import { getListRow } from "../../../companions/client";

export default function EntityList() {
  const { companion = "" } = useParams();
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    void fetchCompanions().then((all) => setManifest(all.find((m) => m.name === companion) ?? null));
    void fetchEntities(companion).then(setEntities);
  }, [companion]);

  if (!manifest) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  const Row = getListRow(companion);

  return (
    <>
      <div className="breadcrumb">Companions / {manifest.displayName}</div>
      <div className="page-title">
        <h3>{manifest.displayName}</h3>
        <button className="btn" onClick={() => navigate(`/c/${companion}/new`)}>+ New</button>
      </div>
      <div className="panel">
        <div className="panel-header" style={{ display: "grid", gridTemplateColumns: "90px 1fr 120px", fontSize: 12, color: "var(--muted)", fontWeight: 400, background: "#f8fafc" }}>
          <div>Status</div>
          <div>Description</div>
          <div>Updated</div>
        </div>
        {entities.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No entries yet — click "+ New" to get started.</div>
        ) : (
          entities.map((e) => (
            <Link key={e.id} to={`/c/${companion}/${e.id}`} style={{ display: "grid", gridTemplateColumns: "90px 1fr 120px", padding: "12px 14px", borderTop: "1px solid var(--border)", alignItems: "center", fontSize: 13, textDecoration: "none", color: "inherit" }}>
              <StatusPill status={e.status} />
              {Row ? <Row entity={e} /> : <div>{(e.input as any).description || JSON.stringify(e.input).slice(0, 80)}</div>}
              <div style={{ color: "var(--muted)" }}>{timeAgo(e.updatedAt)}</div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}
