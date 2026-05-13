import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";

const mockEntity = vi.fn();
vi.mock("../../src/client/hooks/useEntityPolling", () => ({
  useEntityPolling: () => ({ entity: mockEntity(), isPolling: false }),
}));
vi.mock("../../src/client/hooks/useCompanions", () => ({
  useCompanions: () => ({ companions: [{ name: "build", displayName: "Build", icon: "🔨", kind: "ui" }], loading: false }),
}));
vi.mock("../../src/client/api", () => ({
  fetchCompanions: vi.fn().mockResolvedValue([{ name: "build", displayName: "Build", icon: "🔨", kind: "ui" }]),
  continueEntity: vi.fn().mockResolvedValue({}),
}));
vi.mock("../../src/client/hooks/useMcpStatus", () => ({
  useMcpStatus: () => ({ loading: false, firstRequestAt: null, lastRequestAt: null }),
}));

import EntityDetail from "../../src/client/pages/EntityDetail";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/c/:companion/:id" element={<EntityDetail />} /></Routes>
    </MemoryRouter>
  );
}

describe("EntityDetail (facelift)", () => {
  it("renders the 6 build step labels for a Build entity", () => {
    mockEntity.mockReturnValue({
      id: "build-1", companion: "build", status: "running", logs: [{ message: "reading prompt", at: "x", level: "info" }],
      input: {}, createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
    });
    renderAt("/c/build/build-1");
    expect(screen.getByText("Reading prompt")).toBeInTheDocument();
    expect(screen.getByText("First boot")).toBeInTheDocument();
  });

  it("disables 'Open companion' until status is completed", () => {
    mockEntity.mockReturnValue({
      id: "build-1", companion: "build", status: "running", logs: [],
      input: {}, createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
    });
    renderAt("/c/build/build-1");
    const cta = screen.getByRole("link", { name: /open companion/i });
    expect(cta).toHaveAttribute("aria-disabled", "true");
  });

  it("enables 'Open companion' when completed", () => {
    mockEntity.mockReturnValue({
      id: "build-1", companion: "build", status: "completed", logs: [],
      input: { name: "pr-reviewer" }, createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
      artifact: null,
    });
    renderAt("/c/build/build-1");
    const cta = screen.getByRole("link", { name: /open companion/i });
    expect(cta).not.toHaveAttribute("aria-disabled", "true");
  });

  it("shows error panel only when status is error", () => {
    mockEntity.mockReturnValue({
      id: "build-1", companion: "build", status: "error", logs: [],
      input: {}, createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
      errorMessage: "boom",
    });
    renderAt("/c/build/build-1");
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry build/i })).toBeInTheDocument();
  });

  it("does NOT render the step list for non-Build companions", () => {
    mockEntity.mockReturnValue({
      id: "x", companion: "pr-reviewer", status: "running", logs: [],
      input: {}, createdAt: "2026-05-12T10:00:00Z", updatedAt: "2026-05-12T10:00:00Z",
    });
    renderAt("/c/pr-reviewer/x");
    expect(screen.queryByText("Reading prompt")).toBeNull();
  });
});
