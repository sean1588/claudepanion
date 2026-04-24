import { useParams } from "react-router-dom";
import { useCompanions } from "../hooks/useCompanions";
import EntityList from "./EntityList";
import ToolAbout from "./ToolAbout";

export default function CompanionRoute() {
  const { companion } = useParams<{ companion: string }>();
  const { companions, loading } = useCompanions();
  if (loading) return <div style={{ color: "var(--muted)" }}>Loading…</div>;
  const manifest = companions.find((c) => c.name === companion);
  if (!manifest) return <div style={{ color: "#dc2626" }}>Unknown companion: {companion}</div>;
  return manifest.kind === "tool" ? <ToolAbout /> : <EntityList />;
}
