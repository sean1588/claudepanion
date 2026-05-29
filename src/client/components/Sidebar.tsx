import { NavLink } from "react-router-dom";
import { useCompanions } from "../hooks/useCompanions";

export default function Sidebar() {
  const { companions } = useCompanions();
  const build = companions.find((c) => c.name === "build");
  const entities = companions.filter((c) => c.kind === "ui" && c.name !== "build");
  const tools = companions.filter((c) => c.kind === "tool");

  return (
    <aside className="wb-sidebar">
      <div className="wb-sidebar-header">
        <span className="wb-sidebar-dot" aria-hidden />
        <span className="wb-sidebar-wordmark">claudepanion</span>
        <span className="wb-sidebar-port">:3001</span>
      </div>

      <div className="wb-sidebar-section">
        <div className="wb-section-label">Core</div>
      </div>
      {build ? (
        <NavLink
          to={`/c/${build.name}`}
          end
          className={({ isActive }) => `wb-sidebar-link${isActive ? " active" : ""}`}
        >
          <span aria-hidden>🔨</span>
          <span>{build.displayName}</span>
        </NavLink>
      ) : (
        <div className="wb-sidebar-link" aria-disabled>
          <span aria-hidden>🔨</span>
          <span>Build</span>
        </div>
      )}

      <div className="wb-sidebar-section">
        <div className="wb-section-label">Companions</div>
      </div>
      {entities.length === 0 ? (
        <div className="wb-sidebar-empty">// none installed</div>
      ) : (
        entities.map((c) => (
          <NavLink
            key={c.name}
            to={`/c/${c.name}`}
            className={({ isActive }) => `wb-sidebar-link${isActive ? " active" : ""}`}
          >
            <span aria-hidden>{c.icon}</span>
            <span>{c.displayName}</span>
          </NavLink>
        ))
      )}

      <div className="wb-sidebar-section">
        <div className="wb-section-label">Tools</div>
      </div>
      {tools.length === 0 ? (
        <div className="wb-sidebar-empty">// none installed</div>
      ) : (
        tools.map((c) => (
          <NavLink
            key={c.name}
            to={`/c/${c.name}`}
            className={({ isActive }) => `wb-sidebar-link${isActive ? " active" : ""}`}
          >
            <span aria-hidden>{c.icon}</span>
            <span>{c.displayName}</span>
          </NavLink>
        ))
      )}

      <div className="wb-sidebar-footer">
        <NavLink
          to="/install"
          className={({ isActive }) => `wb-sidebar-link${isActive ? " active" : ""}`}
          style={{ padding: 0, paddingLeft: 0, border: 0, background: "transparent", color: "var(--accent)" }}
        >
          <span aria-hidden>$</span>
          <span>install companion</span>
        </NavLink>
        <div className="wb-sidebar-disclaimer">{`// independent\n// not affiliated with anthropic`}</div>
      </div>
    </aside>
  );
}
