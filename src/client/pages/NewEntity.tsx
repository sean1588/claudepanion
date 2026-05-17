import { useParams, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Manifest } from "@shared/types";
import { createEntity, fetchCompanions } from "../api";
import { getForm, getInputSchema } from "../../../companions/client";
import { CompanionForm } from "../primitives/CompanionForm";
import PreflightBanner from "../components/PreflightBanner";
import { useInputSchema } from "../hooks/useInputSchema";

export default function NewEntity() {
  const { companion = "" } = useParams();
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [blocked, setBlocked] = useState(false);

  const compileTimeSchema = getInputSchema(companion);
  const Override = getForm(companion);
  const needsRuntimeFetch = !Override && !compileTimeSchema;
  const runtime = useInputSchema(needsRuntimeFetch ? companion : undefined);

  useEffect(() => {
    void fetchCompanions().then((all) => setManifest(all.find((m) => m.name === companion) ?? null));
  }, [companion]);

  if (!manifest) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  const onSubmit = async (input: unknown) => {
    if (blocked) return;
    const e = await createEntity(companion, input);
    navigate(`/c/${companion}/${e.id}`);
  };

  let formEl: React.ReactNode;
  if (Override) {
    formEl = <Override onSubmit={onSubmit} />;
  } else if (compileTimeSchema && "shape" in compileTimeSchema) {
    formEl = <CompanionForm schema={compileTimeSchema as any} onSubmit={onSubmit} companionSlug={companion} />;
  } else if (runtime.loading) {
    formEl = <div className="t-caption">Loading form…</div>;
  } else if (runtime.schema) {
    formEl = <CompanionForm schema={runtime.schema as any} onSubmit={onSubmit} companionSlug={companion} />;
  } else if (runtime.error) {
    formEl = <div style={{ color: "var(--status-error)" }}>Could not load form: {runtime.error}</div>;
  } else {
    formEl = <div className="t-caption">No form registered for {companion} (and no InputSchema found in companions/{companion}/types.ts).</div>;
  }

  return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="t-mono" style={{ color: "var(--muted)" }}>
        <Link to="/" style={{ color: "var(--muted)", textDecoration: "none" }}>claudepanion</Link>
        {" › "}
        <Link to={`/c/${manifest.name}`} style={{ color: "var(--muted)", textDecoration: "none" }}>{manifest.displayName}</Link>
        {" › "}
        <span>New</span>
      </div>
      <span className="t-eyebrow">New {companion === "build" ? "companion" : "run"}</span>
      <h1 className="t-display-sm" style={{ margin: 0 }}>{manifest.displayName}</h1>
      {manifest.description && <p className="t-body" style={{ color: "var(--muted)", margin: 0, maxWidth: "62ch" }}>{manifest.description}</p>}
      <PreflightBanner companion={companion} onStatus={(s) => setBlocked(s.blocked)} />
      <fieldset disabled={blocked} style={{ border: "none", padding: 0, margin: 0 }}>
        {formEl}
      </fieldset>
    </div>
  );
}
