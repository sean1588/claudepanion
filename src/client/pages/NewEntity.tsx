import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Manifest } from "@shared/types";
import { createEntity, fetchCompanions } from "../api";
import { getForm } from "../../../companions/client";
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

  const Form = getForm(companion);
  if (!Form) return <div>No form registered for {companion}.</div>;

  return (
    <>
      <Breadcrumb manifest={manifest} trailing="New" />
      <div className="page-title"><h1>{companion === "build" ? "New companion" : "New entry"}</h1></div>
      <PreflightBanner companion={companion} onStatus={(s) => setBlocked(s.blocked)} />
      <fieldset disabled={blocked} style={{ border: "none", padding: 0, margin: 0 }}>
        <Form onSubmit={async (input) => {
          if (blocked) return;
          const e = await createEntity(companion, input);
          navigate(`/c/${companion}/${e.id}`);
        }} />
      </fieldset>
    </>
  );
}
