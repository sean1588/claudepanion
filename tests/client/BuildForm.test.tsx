import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import BuildForm from "../../companions/build/form";
import type { BuildInput } from "../../companions/build/types";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.startsWith("/api/companions")) {
      return new Response(JSON.stringify([
        { name: "build", kind: "ui", displayName: "Build", icon: "🔨", description: "", contractVersion: "2", version: "0.1.0" },
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
    renderAt("/c/build/new?example=github-pr-reviewer");
    const name = await screen.findByLabelText(/companion name/i) as HTMLInputElement;
    const description = await screen.findByLabelText(/^description$/i) as HTMLTextAreaElement;
    // Kind is now a radiogroup; find the "ui companion" radio (maps to "ui" kind)
    const uiRadio = await screen.findByRole("radio", { name: /ui companion/i });
    await waitFor(() => {
      expect(name.value).toBe("github-pr-reviewer");
      expect(uiRadio).toHaveAttribute("aria-checked", "true");
      expect(description.value).toMatch(/structured code-review report/i);
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

  it("does NOT include example slug in submitted input even when URL has ?example=", async () => {
    let submitted: BuildInput | null = null;
    render(
      <MemoryRouter initialEntries={["/c/build/new?example=github-pr-reviewer"]}>
        <Routes>
          <Route path="*" element={<BuildForm onSubmit={(i) => { submitted = i; }} />} />
        </Routes>
      </MemoryRouter>
    );
    const btn = await screen.findByRole("button", { name: /build companion/i });
    fireEvent.click(btn);
    await waitFor(() => expect(submitted).not.toBeNull());
    // Chips are form-text-prefill sugar only — example slug must NOT leak into the entity input.
    expect(submitted!).toMatchObject({ mode: "new-companion", name: "github-pr-reviewer" });
    expect((submitted as { example?: string }).example).toBeUndefined();
  });

  it("blocks submit and shows an error when the companion name is already taken", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("/api/companions")) {
        return new Response(JSON.stringify([
          { name: "build", kind: "ui", displayName: "Build", icon: "🔨", description: "", contractVersion: "2", version: "0.1.0" },
          { name: "github-pr-reviewer", kind: "ui", displayName: "GitHub PR Reviewer", icon: "🔍", description: "", contractVersion: "2", version: "0.1.0" },
        ]), { status: 200 });
      }
      throw new Error(`unexpected ${url}`);
    }));
    let submitted: BuildInput | null = null;
    render(
      <MemoryRouter initialEntries={["/c/build/new"]}>
        <Routes>
          <Route path="*" element={<BuildForm onSubmit={(i) => { submitted = i; }} />} />
        </Routes>
      </MemoryRouter>
    );
    const nameInput = await screen.findByLabelText(/companion name/i) as HTMLInputElement;
    const descInput = await screen.findByLabelText(/^description$/i) as HTMLTextAreaElement;
    fireEvent.change(nameInput, { target: { value: "github-pr-reviewer" } });
    fireEvent.change(descInput, { target: { value: "another reviewer" } });
    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /build companion/i }));
    expect(submitted).toBeNull();
  });

  it("allows submit when the name is unique", async () => {
    let submitted: BuildInput | null = null;
    render(
      <MemoryRouter initialEntries={["/c/build/new"]}>
        <Routes>
          <Route path="*" element={<BuildForm onSubmit={(i) => { submitted = i; }} />} />
        </Routes>
      </MemoryRouter>
    );
    const nameInput = await screen.findByLabelText(/companion name/i) as HTMLInputElement;
    const descInput = await screen.findByLabelText(/^description$/i) as HTMLTextAreaElement;
    fireEvent.change(nameInput, { target: { value: "totally-new-thing" } });
    fireEvent.change(descInput, { target: { value: "fresh companion" } });
    fireEvent.click(screen.getByRole("button", { name: /build companion/i }));
    await waitFor(() => expect(submitted).not.toBeNull());
    expect(submitted!).toMatchObject({ mode: "new-companion", name: "totally-new-thing" });
  });

  it("omits example field in submitted input when URL has no ?example=", async () => {
    let submitted: BuildInput | null = null;
    render(
      <MemoryRouter initialEntries={["/c/build/new"]}>
        <Routes>
          <Route path="*" element={<BuildForm onSubmit={(i) => { submitted = i; }} />} />
        </Routes>
      </MemoryRouter>
    );
    const nameInput = await screen.findByLabelText(/companion name/i) as HTMLInputElement;
    const descInput = await screen.findByLabelText(/^description$/i) as HTMLTextAreaElement;
    fireEvent.change(nameInput, { target: { value: "handwritten" } });
    fireEvent.change(descInput, { target: { value: "no example" } });
    fireEvent.click(screen.getByRole("button", { name: /build companion/i }));
    await waitFor(() => expect(submitted).not.toBeNull());
    expect(submitted!).toMatchObject({ mode: "new-companion", name: "handwritten" });
    expect((submitted as { example?: string }).example).toBeUndefined();
  });
});
