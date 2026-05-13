import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import Sidebar from "../../src/client/components/Sidebar";

vi.mock("../../src/client/hooks/useCompanions", () => ({
  useCompanions: () => ({
    companions: [
      { name: "build", displayName: "Build", icon: "🔨", kind: "ui" },
      { name: "pr-reviewer", displayName: "PR reviewer", icon: "🔎", kind: "ui" },
    ],
    loading: false,
  }),
}));

vi.mock("../../src/client/hooks/useHealth", () => ({
  useHealth: () => ({
    host: "running",
    pluginInstalled: true,
    mcp: { firstRequestAt: new Date(Date.now() - 60_000).toISOString(), lastRequestAt: new Date().toISOString() },
  }),
}));

describe("Sidebar", () => {
  it("renders CORE / COMPANIONS / SYSTEM section labels", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText("Core")).toBeInTheDocument();
    expect(screen.getByText("Companions")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("renders SystemRail rows with status labels", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText("host running")).toBeInTheDocument();
    expect(screen.getByText("MCP /mcp open")).toBeInTheDocument();
    expect(screen.getByText("plugin installed")).toBeInTheDocument();
  });

  it("keeps Install companion as the footer link", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /install companion/i })).toBeInTheDocument();
  });
});
