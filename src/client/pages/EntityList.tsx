import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import type { Entity, Manifest } from "@shared/types";
import { fetchCompanions, fetchEntities } from "../api";
import StatusPill from "../components/StatusPill";
import Breadcrumb from "../components/Breadcrumb";
import BuildEmptyState from "./BuildEmptyState";
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
      <Breadcrumb manifest={manifest} />
      <div className="page-title">
        <h1>{manifest.displayName}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {companion === "build" ? (
            <>
              <button
                type="button"
                className="btn-outline"
                onClick={() => navigate(`/c/build/new?mode=iterate`)}
              >
                ⟳ Iterate on existing
              </button>
              <button className="btn" onClick={() => navigate(`/c/build/new`)}>+ New companion</button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-outline"
                onClick={() => navigate(`/c/build/new?mode=iterate&target=${companion}`)}
              >
                🔨 Iterate with Build
              </button>
              <button className="btn" onClick={() => navigate(`/c/${companion}/new`)}>+ New</button>
            </>
          )}
        </div>
      </div>
      {companion === "build" && entities.length === 0 ? (
        <BuildEmptyState />
      ) : (
        <div className="panel entity-list">
          <div className="panel-header entity-list-header">
            <div>Status</div>
            <div>Description</div>
            <div className="entity-list-updated">Updated</div>
          </div>
          {entities.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No entries yet — click "+ New" to get started.</div>
          ) : (
            entities.map((e) => (
              <Link key={e.id} to={`/c/${companion}/${e.id}`} className="entity-list-row">
                <StatusPill status={e.status} />
                {Row ? <Row entity={e} /> : <div>{(e.input as any).description || JSON.stringify(e.input).slice(0, 80)}</div>}
                <div className="entity-list-updated" style={{ color: "var(--muted)" }}>{timeAgo(e.updatedAt)}</div>
              </Link>
            ))
          )}
        </div>
      )}
    </>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}
