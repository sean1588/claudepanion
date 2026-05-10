import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Manifest } from "@shared/types";
import { createEntity, fetchCompanions } from "../api";
import { getForm, getInputSchema } from "../../../companions/client";
import { CompanionForm } from "../primitives/CompanionForm";
import Breadcrumb from "../components/Breadcrumb";
import PreflightBanner from "../components/PreflightBanner";

export default function NewEntity() {
  const { companion = "" } = useParams();
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    void fetchCompanions().then((all) => setManifest(all.find((m) => m.name === companion) ?? null));
  }, [companion]);

  if (!manifest) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  const onSubmit = async (input: unknown) => {
    if (blocked) return;
    const e = await createEntity(companion, input);
    navigate(`/c/${companion}/${e.id}`);
  };

  const Override = getForm(companion);
  const schema = getInputSchema(companion);
  let formEl: React.ReactNode;
  if (Override) {
    formEl = <Override onSubmit={onSubmit} />;
  } else if (schema && "shape" in schema) {
    formEl = <CompanionForm schema={schema as any} onSubmit={onSubmit} companionSlug={companion} />;
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
