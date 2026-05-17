import { NavLink } from "react-router-dom";
import { useCompanions } from "../hooks/useCompanions";
import { Sketch } from "../icons/Sketch";
import SystemRail from "./SystemRail";

export default function Sidebar() {
  const { companions } = useCompanions();
  const build = companions.find((c) => c.name === "build");
  const entities = companions.filter((c) => c.kind === "ui" && c.name !== "build");
  const tools = companions.filter((c) => c.kind === "tool");

  return (
    <aside className="app-sidebar editorial-sidebar">
      <div className="sidebar-wordmark">
        <span className="t-display-sm" style={{ fontSize: 28, lineHeight: 1, color: "var(--ink)" }}>claudepanion</span>
        <span className="t-mono" style={{ color: "var(--muted)", fontSize: 11 }}>v0.1 · localhost</span>
      </div>

      <div className="sidebar-section">
        <div className="t-eyebrow sidebar-section-label">Core</div>
        {build ? (
          <NavLink to={`/c/${build.name}`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <Sketch.Wrench size={20} aria-hidden />
            <span>{build.displayName}</span>
          </NavLink>
        ) : (
          <div className="sidebar-link" aria-disabled>
            <Sketch.Wrench size={20} aria-hidden />
            <span>Build</span>
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <div className="t-eyebrow sidebar-section-label">Companions</div>
        {entities.length === 0 ? (
          <div className="t-caption" style={{ padding: "4px 12px", fontStyle: "italic" }}>
            Build something to fill this section.
          </div>
        ) : entities.map((c) => (
          <NavLink key={c.name} to={`/c/${c.name}`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <span aria-hidden>{c.icon}</span>
            <span>{c.displayName}</span>
          </NavLink>
        ))}
        {tools.length > 0 && tools.map((c) => (
          <NavLink key={c.name} to={`/c/${c.name}`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <span aria-hidden>{c.icon}</span>
            <span>{c.displayName}</span>
          </NavLink>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="t-eyebrow sidebar-section-label">System</div>
        <div style={{ padding: "0 12px" }}>
          <SystemRail />
        </div>
      </div>

      <div className="sidebar-footer">
        <NavLink to="/install" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
          <span aria-hidden>+</span>
          <span>Install companion</span>
        </NavLink>
      </div>
    </aside>
  );
}
