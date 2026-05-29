import { useParams, useNavigate } from "react-router-dom";
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

  if (!manifest) return <div style={{ padding: 24, color: "var(--muted)" }}>Loading…</div>;

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
    formEl = <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>Loading form…</div>;
  } else if (runtime.schema) {
    formEl = <CompanionForm schema={runtime.schema as any} onSubmit={onSubmit} companionSlug={companion} />;
  } else if (runtime.error) {
    formEl = <div style={{ color: "var(--status-error)" }}>Could not load form: {runtime.error}</div>;
  } else {
    formEl = <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>No form registered for {companion} (and no InputSchema found in companions/{companion}/types.ts).</div>;
  }

  // If the companion ships a custom form (e.g. Build), let it render its own
  // header — but still surface PreflightBanner since it's global state.
  if (Override) {
    return (
      <>
        <div style={{ padding: "16px 28px 0" }}>
          <PreflightBanner companion={companion} onStatus={(s) => setBlocked(s.blocked)} />
        </div>
        <fieldset disabled={blocked} style={{ border: "none", padding: 0, margin: 0 }}>
          {formEl}
        </fieldset>
      </>
    );
  }

  return (
    <div style={{ padding: "22px 28px 60px", maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="wb-section-label" style={{ marginBottom: 8 }}>
          new {companion === "build" ? "companion" : "run"}
        </div>
        <h1 className="wb-serif" style={{ fontSize: 38, lineHeight: 1.05, margin: "0 0 8px" }}>
          {manifest.displayName}
        </h1>
        {manifest.description && (
          <p className="wb-sans" style={{ color: "var(--muted)", margin: 0, fontSize: 13, lineHeight: 1.55, maxWidth: 640 }}>
            {manifest.description}
          </p>
        )}
      </div>
      <PreflightBanner companion={companion} onStatus={(s) => setBlocked(s.blocked)} />
      <fieldset disabled={blocked} style={{ border: "none", padding: 0, margin: 0 }}>
        {formEl}
      </fieldset>
    </div>
  );
}
