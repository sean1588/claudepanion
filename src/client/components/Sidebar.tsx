import { NavLink } from "react-router-dom";
import { useCompanions } from "../hooks/useCompanions";

export default function Sidebar() {
  const { companions } = useCompanions();
  const entities = companions.filter((c) => c.kind === "entity");
  const tools = companions.filter((c) => c.kind === "tool");

  return (
    <aside className="app-sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon" />
        <span>claudepanion</span>
      </div>
      <div className="sidebar-section-label">Core</div>
      <div className="sidebar-link" aria-disabled>🔨 Build <span style={{ marginLeft: "auto", fontSize: 10, color: "#64748b" }}>soon</span></div>
      {entities.length > 0 && (
        <>
          <div className="sidebar-section-label">Companions</div>
          {entities.map((c) => (
            <NavLink key={c.name} to={`/c/${c.name}`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
              <span>{c.icon}</span>
              <span>{c.displayName}</span>
            </NavLink>
          ))}
        </>
      )}
      {tools.length > 0 && (
        <>
          <div className="sidebar-section-label">Tools</div>
          {tools.map((c) => (
            <NavLink key={c.name} to={`/c/${c.name}`} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
              <span>{c.icon}</span>
              <span>{c.displayName}</span>
            </NavLink>
          ))}
        </>
      )}
    </aside>
  );
}
