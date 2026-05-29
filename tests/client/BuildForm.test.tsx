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
  it("prefills name/kind/goal/artifact/behavior + field rows from a known example slug", async () => {
    renderAt("/c/build/new?example=github-pr-reviewer");
    const name = await screen.findByLabelText(/companion name/i) as HTMLInputElement;
    const goal = await screen.findByLabelText(/^goal$/i) as HTMLTextAreaElement;
    const artifact = await screen.findByLabelText(/artifact template/i) as HTMLTextAreaElement;
    const behavior = await screen.findByLabelText(/behavior & constraints/i) as HTMLTextAreaElement;
    const uiRadio = await screen.findByRole("radio", { name: /ui companion/i });
    await waitFor(() => {
      expect(name.value).toBe("github-pr-reviewer");
      expect(uiRadio).toHaveAttribute("aria-checked", "true");
      expect(goal.value).toMatch(/structured code-review report/i);
      expect(artifact.value).toMatch(/verdict/i);
      expect(behavior.value).toMatch(/read-only/i);
    });
    // Structured field rows prefilled — at least the "Repo" row name input is visible.
    const repoInput = await screen.findByDisplayValue("Repo") as HTMLInputElement;
    expect(repoInput).toBeInTheDocument();
  });

  it("falls back to an empty form when example slug is unknown", async () => {
    renderAt("/c/build/new?example=does-not-exist");
    const name = await screen.findByLabelText(/companion name/i) as HTMLInputElement;
    const goal = await screen.findByLabelText(/^goal$/i) as HTMLTextAreaElement;
    expect(name.value).toBe("");
    expect(goal.value).toBe("");
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
    const btn = await screen.findByRole("button", { name: /submit/i });
    fireEvent.click(btn);
    await waitFor(() => expect(submitted).not.toBeNull());
    // Chips are form-prefill sugar only — example slug must NOT leak into the entity input.
    expect(submitted!).toMatchObject({ mode: "new-companion", name: "github-pr-reviewer" });
    expect((submitted as { example?: string }).example).toBeUndefined();
    // The serialized description should carry the structured pieces.
    expect(submitted!.description).toMatch(/structured code-review report/i);
    expect(submitted!.description).toMatch(/Form fields:/);
    expect(submitted!.description).toMatch(/\*\*Repo\*\* \(required\)/);
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
    const goalInput = await screen.findByLabelText(/^goal$/i) as HTMLTextAreaElement;
    fireEvent.change(nameInput, { target: { value: "github-pr-reviewer" } });
    fireEvent.change(goalInput, { target: { value: "another reviewer" } });
    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
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
    const goalInput = await screen.findByLabelText(/^goal$/i) as HTMLTextAreaElement;
    fireEvent.change(nameInput, { target: { value: "totally-new-thing" } });
    fireEvent.change(goalInput, { target: { value: "fresh companion" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => expect(submitted).not.toBeNull());
    expect(submitted!).toMatchObject({ mode: "new-companion", name: "totally-new-thing" });
    expect(submitted!.description).toMatch(/fresh companion/);
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
    const goalInput = await screen.findByLabelText(/^goal$/i) as HTMLTextAreaElement;
    fireEvent.change(nameInput, { target: { value: "handwritten" } });
    fireEvent.change(goalInput, { target: { value: "no example" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => expect(submitted).not.toBeNull());
    expect(submitted!).toMatchObject({ mode: "new-companion", name: "handwritten" });
    expect((submitted as { example?: string }).example).toBeUndefined();
  });

  it("switches to tool kind: hides UI sections, shows Tools, serializes tool list", async () => {
    let submitted: BuildInput | null = null;
    render(
      <MemoryRouter initialEntries={["/c/build/new"]}>
        <Routes>
          <Route path="*" element={<BuildForm onSubmit={(i) => { submitted = i; }} />} />
        </Routes>
      </MemoryRouter>
    );
    // Switch kind to tool.
    const toolRadio = await screen.findByRole("radio", { name: /tool companion/i });
    fireEvent.click(toolRadio);
    // UI-only sections gone.
    await waitFor(() => {
      expect(screen.queryByLabelText(/^form fields$/i)).toBeNull();
      expect(screen.queryByLabelText(/artifact template/i)).toBeNull();
    });
    // Tools section visible.
    const firstToolName = await screen.findByLabelText(/tool 1 name/i) as HTMLInputElement;
    const firstToolDesc = await screen.findByLabelText(/tool 1 description/i) as HTMLTextAreaElement;
    const firstToolArgs = await screen.findByLabelText(/tool 1 args/i) as HTMLTextAreaElement;
    // Fill name, goal, tool.
    fireEvent.change(screen.getByLabelText(/companion name/i), { target: { value: "url-fetcher" } });
    fireEvent.change(screen.getByLabelText(/^goal$/i), { target: { value: "Fetch URLs and return their content as text." } });
    fireEvent.change(firstToolName, { target: { value: "fetch_url" } });
    fireEvent.change(firstToolDesc, { target: { value: "Fetch a URL and return its body as UTF-8 text." } });
    fireEvent.change(firstToolArgs, { target: { value: "url: string (required) — URL to fetch" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => expect(submitted).not.toBeNull());
    expect(submitted!).toMatchObject({ mode: "new-companion", name: "url-fetcher", kind: "tool" });
    expect(submitted!.description).toMatch(/Tools to expose:/);
    expect(submitted!.description).toMatch(/\*\*fetch_url\*\*/);
    expect(submitted!.description).toMatch(/url: string \(required\)/);
    // No ui-only sections in serialized output.
    expect(submitted!.description).not.toMatch(/Form fields:/);
    expect(submitted!.description).not.toMatch(/artifact follows a fixed template/i);
  });

  it("lets the user add and remove field rows", async () => {
    renderAt("/c/build/new");
    // Default: one empty field row.
    const firstFieldName = await screen.findByLabelText(/field 1 name/i) as HTMLInputElement;
    expect(firstFieldName).toBeInTheDocument();
    // Remove button on the only row is disabled.
    const removeFirst = screen.getByLabelText(/remove field 1/i) as HTMLButtonElement;
    expect(removeFirst).toBeDisabled();
    // Add a row.
    fireEvent.click(screen.getByRole("button", { name: /add field/i }));
    const secondFieldName = await screen.findByLabelText(/field 2 name/i) as HTMLInputElement;
    expect(secondFieldName).toBeInTheDocument();
    // Now remove buttons are enabled.
    expect((screen.getByLabelText(/remove field 1/i) as HTMLButtonElement).disabled).toBe(false);
    // Remove row 2.
    fireEvent.click(screen.getByLabelText(/remove field 2/i));
    await waitFor(() => {
      expect(screen.queryByLabelText(/field 2 name/i)).toBeNull();
    });
  });
});
