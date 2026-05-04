import { NavLink } from "react-router-dom";
import { useCompanions } from "../hooks/useCompanions";

export default function Sidebar() {
  const { companions } = useCompanions();
  const build = companions.find((c) => c.name === "build");
  const entities = companions.filter((c) => c.kind === "entity" && c.name !== "build");
  const tools = companions.filter((c) => c.kind === "tool");

  return (
    <aside className="app-sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon" />
        <span className="sidebar-logo-name">claudepanion</span>
      </div>
      <div className="sidebar-logo-sub">localhost:3001</div>

      <div className="sidebar-section-label">Core</div>
      {build ? (
        <NavLink to={`/c/${build.name}`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
          <span className="sidebar-link-icon">{build.icon}</span>
          <span>{build.displayName}</span>
        </NavLink>
      ) : (
        <div className="sidebar-link sidebar-link-muted" aria-disabled>
          <span className="sidebar-link-icon">🔨</span>
          <span>Build</span>
        </div>
      )}

      <div className="sidebar-section-label">Companions</div>
      {entities.length > 0 ? (
        entities.map((c) => (
          <NavLink key={c.name} to={`/c/${c.name}`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <span className="sidebar-link-icon">{c.icon}</span>
            <span>{c.displayName}</span>
          </NavLink>
        ))
      ) : (
        <div className="sidebar-section-empty">Build something to fill this section.</div>
      )}

      <div className="sidebar-section-label">Tools</div>
      {tools.length > 0 ? (
        tools.map((c) => (
          <NavLink key={c.name} to={`/c/${c.name}`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            <span className="sidebar-link-icon">{c.icon}</span>
            <span>{c.displayName}</span>
          </NavLink>
        ))
      ) : (
        <div className="sidebar-section-empty">—</div>
      )}

      <div className="sidebar-footer">
        <NavLink to="/install" className={({ isActive }) => `sidebar-link sidebar-link-muted${isActive ? " active" : ""}`}>
          <span className="sidebar-link-icon">+</span>
          <span>Install companion</span>
        </NavLink>
        <div className="sidebar-footnote">Independent open-source project. Not affiliated with Anthropic.</div>
      </div>
    </aside>
  );
}
