import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Manifest } from "@shared/types";
import { createEntity, fetchCompanions } from "../api";
import { getForm, getInputSchema } from "../../../companions/client";
import { CompanionForm } from "../primitives/CompanionForm";
import Breadcrumb from "../components/Breadcrumb";
import PreflightBanner from "../components/PreflightBanner";
import { useInputSchema } from "../hooks/useInputSchema";

export default function NewEntity() {
  const { companion = "" } = useParams();
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [blocked, setBlocked] = useState(false);

  // Compile-time schema (in the framework's bundle — only built-in companions
  // like Build). For user-local companions added after the framework was
  // built, we fall back to the runtime fetch below.
  const compileTimeSchema = getInputSchema(companion);
  const Override = getForm(companion);
  // Only fetch from the server when we'd actually use it: no override, no
  // compile-time schema. Passing undefined short-circuits the hook.
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
    formEl = <div style={{ color: "var(--muted)" }}>Loading form…</div>;
  } else if (runtime.schema) {
    formEl = <CompanionForm schema={runtime.schema as any} onSubmit={onSubmit} companionSlug={companion} />;
  } else if (runtime.error) {
    formEl = <div style={{ color: "#dc2626" }}>Could not load form: {runtime.error}</div>;
  } else {
    formEl = <div>No form registered for {companion} (and no InputSchema found in companions/{companion}/types.ts).</div>;
  }

  return (
    <>
      <Breadcrumb manifest={manifest} trailing="New" />
      <div className="page-title"><h1>{companion === "build" ? "New companion" : "New entry"}</h1></div>
      <PreflightBanner companion={companion} onStatus={(s) => setBlocked(s.blocked)} />
      <fieldset disabled={blocked} style={{ border: "none", padding: 0, margin: 0 }}>
        {formEl}
      </fieldset>
    </>
  );
}
