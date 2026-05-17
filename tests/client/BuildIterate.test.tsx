import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateEntity = vi.fn();

vi.mock("../../src/client/hooks/useCompanions", () => ({
  useCompanions: () => ({
    companions: [
      { name: "build", displayName: "Build", icon: "🔨", kind: "ui", version: "0.1.0", description: "Scaffolds new companions" },
      { name: "pr-reviewer", displayName: "PR reviewer", icon: "🔎", kind: "ui", version: "0.3.1", description: "Reviews a GitHub PR." },
    ],
    loading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../src/client/api", () => ({
  createEntity: (...args: unknown[]) => mockCreateEntity(...args),
}));

import BuildIterate from "../../src/client/pages/BuildIterate";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/c/build/iterate/:target" element={<BuildIterate />} />
        <Route path="/c/build/evolve" element={<div>Picker</div>} />
        <Route path="/c/build/:id" element={<div>Detail</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("BuildIterate", () => {
  beforeEach(() => { mockCreateEntity.mockReset(); });

  it("renders 'Evolving <name>' hero and the locked target card", () => {
    renderAt("/c/build/iterate/pr-reviewer");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Evolving.*PR reviewer/i);
    expect(screen.getByText(/v0\.3\.1/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /change/i })).toHaveAttribute("href", "/c/build/evolve");
  });

  it("redirects to picker when target slug is unknown", async () => {
    renderAt("/c/build/iterate/does-not-exist");
    await waitFor(() => expect(screen.getByText("Picker")).toBeInTheDocument());
  });

  it("redirects to picker when target is 'build' itself", async () => {
    renderAt("/c/build/iterate/build");
    await waitFor(() => expect(screen.getByText("Picker")).toBeInTheDocument());
  });

  it("submits iterate-companion entity and navigates to detail", async () => {
    mockCreateEntity.mockResolvedValueOnce({ id: "build-xyz" });
    renderAt("/c/build/iterate/pr-reviewer");
    fireEvent.change(screen.getByLabelText(/what should change/i), { target: { value: "add markdown summary" } });
    fireEvent.click(screen.getByRole("button", { name: /iterate/i }));
    await waitFor(() => expect(mockCreateEntity).toHaveBeenCalledWith("build", {
      mode: "iterate-companion",
      target: "pr-reviewer",
      description: "add markdown summary",
    }));
    await waitFor(() => expect(screen.getByText("Detail")).toBeInTheDocument());
  });

  it("blocks submit when description is empty", () => {
    renderAt("/c/build/iterate/pr-reviewer");
    fireEvent.click(screen.getByRole("button", { name: /iterate/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Describe what should change/i);
    expect(mockCreateEntity).not.toHaveBeenCalled();
  });
});
