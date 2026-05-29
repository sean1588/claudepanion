import { useLocation, useParams } from "react-router-dom";
import SystemRail from "./SystemRail";

function routeLabel(pathname: string, params: Record<string, string | undefined>): { path: string; aside?: string } {
  if (pathname === "/" || pathname === "/c/build") return { path: "~/build", aside: "the build companion" };
  if (pathname === "/install") return { path: "~/install", aside: "from npm" };
  if (pathname.startsWith("/c/build/evolve")) return { path: "~/build/evolve", aside: "iterate on an existing companion" };
  if (pathname.startsWith("/c/build/iterate/") && params.target) return { path: `~/build/iterate/${params.target}` };
  if (pathname.endsWith("/new") && params.companion) return { path: `~/${params.companion}/new`, aside: "new run" };
  if (pathname.endsWith("/runs") && params.companion) return { path: `~/${params.companion}/runs` };
  if (params.companion && params.id) return { path: `~/${params.companion}/${params.id}` };
  if (params.companion) return { path: `~/${params.companion}` };
  return { path: `~${pathname}` };
}

export default function TopBar() {
  const { pathname } = useLocation();
  const params = useParams();
  const { path, aside } = routeLabel(pathname, params);

  return (
    <header className="wb-topbar">
      <div style={{ color: "var(--muted)" }}>
        <span style={{ color: "var(--ink)" }}>{path}</span>
        {aside && <span> — {aside}</span>}
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <SystemRail />
      </div>
    </header>
  );
}
