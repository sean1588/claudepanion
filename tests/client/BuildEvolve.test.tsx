import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import BuildEvolve from "../../src/client/pages/BuildEvolve";

vi.mock("../../src/client/hooks/useCompanions", () => ({
  useCompanions: () => ({
    companions: [
      { name: "build", displayName: "Build", icon: "🔨", kind: "ui", version: "0.1.0", description: "Scaffolds new companions" },
      { name: "pr-reviewer", displayName: "PR reviewer", icon: "🔎", kind: "ui", version: "0.3.1", description: "Reviews a GitHub PR." },
      { name: "oncall", displayName: "Oncall", icon: "📟", kind: "ui", version: "0.1.0", description: "Triages alerts." },
      { name: "weather-tool", displayName: "Weather tool", icon: "☀️", kind: "tool", version: "0.1.0", description: "Returns the forecast." },
    ],
    loading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../src/client/api", () => ({
  fetchEntities: vi.fn().mockResolvedValue([]),
}));

describe("BuildEvolve", () => {
  it("renders only ui-kind companions, excluding Build itself and tool-kind companions", async () => {
    render(<MemoryRouter><BuildEvolve /></MemoryRouter>);
    expect(await screen.findByText("PR reviewer")).toBeInTheDocument();
    expect(screen.getByText("Oncall")).toBeInTheDocument();
    // Tool-kind and Build should not appear as picker rows (Build appears in
    // breadcrumb only; assert via role=link to scope to picker entries).
    const links = screen.getAllByRole("link");
    expect(links.find((l) => l.getAttribute("href") === "/c/build/new?mode=iterate&target=build")).toBeUndefined();
    expect(links.find((l) => l.getAttribute("href") === "/c/build/new?mode=iterate&target=weather-tool")).toBeUndefined();
  });

  it("rows link to /c/build/new?mode=iterate&target=<slug>", () => {
    render(<MemoryRouter><BuildEvolve /></MemoryRouter>);
    const link = screen.getByRole("link", { name: /PR reviewer/i });
    expect(link.getAttribute("href")).toBe("/c/build/new?mode=iterate&target=pr-reviewer");
  });

  it("renders 'Which companion?' as the page heading", () => {
    render(<MemoryRouter><BuildEvolve /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Which.*companion/i);
  });
});
