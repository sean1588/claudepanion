import { Link } from "react-router-dom";
import type { Manifest } from "@shared/types";

function sectionLabel(m: Manifest): string {
  if (m.name === "build") return "Core";
  return m.kind === "tool" ? "Tools" : "Companions";
}

interface Props {
  manifest: Manifest;
  trailing?: string;
}

export default function Breadcrumb({ manifest, trailing }: Props) {
  return (
    <div className="breadcrumb">
      {sectionLabel(manifest)} / <Link to={`/c/${manifest.name}`}>{manifest.displayName}</Link>
      {trailing ? <> / {trailing}</> : null}
    </div>
  );
}
