import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import BuildForm from "../../companions/build/form";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.startsWith("/api/companions")) {
      return new Response(JSON.stringify([
        { name: "build", kind: "entity", displayName: "Build", icon: "🔨", description: "", contractVersion: "1", version: "0.1.0" },
      ]), { status: 200 });
    }
    throw new Error(`unexpected ${url}`);
  }));
});
afterEach(() => vi.restoreAllMocks());

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<BuildForm onSubmit={() => { }} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("BuildForm ?example= prefill", () => {
  it("prefills name/kind/description from a known example slug", async () => {
    renderAt("/c/build/new?example=pr-reviewer");
    const name = await screen.findByLabelText(/companion name/i) as HTMLInputElement;
    const description = await screen.findByLabelText(/^description$/i) as HTMLTextAreaElement;
    const kind = await screen.findByLabelText(/kind/i) as HTMLSelectElement;
    await waitFor(() => {
      expect(name.value).toBe("pr-reviewer");
      expect(kind.value).toBe("entity");
      expect(description.value).toMatch(/flag risky diffs/i);
    });
  });

  it("falls back to an empty form when example slug is unknown", async () => {
    renderAt("/c/build/new?example=does-not-exist");
    const name = await screen.findByLabelText(/companion name/i) as HTMLInputElement;
    const description = await screen.findByLabelText(/^description$/i) as HTMLTextAreaElement;
    expect(name.value).toBe("");
    expect(description.value).toBe("");
  });

  it("falls back to an empty form when no example param is given", async () => {
    renderAt("/c/build/new");
    const name = await screen.findByLabelText(/companion name/i) as HTMLInputElement;
    expect(name.value).toBe("");
  });
});
