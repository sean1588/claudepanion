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

describe("Sidebar", () => {
  it("renders CORE / COMPANIONS / TOOLS section labels", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText("Core")).toBeInTheDocument();
    expect(screen.getByText("Companions")).toBeInTheDocument();
    expect(screen.getByText("Tools")).toBeInTheDocument();
  });

  it("keeps install companion as the footer link", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /install companion/i })).toBeInTheDocument();
  });

  it("lists installed ui companions and the build companion", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /Build/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PR reviewer/i })).toBeInTheDocument();
  });
});
