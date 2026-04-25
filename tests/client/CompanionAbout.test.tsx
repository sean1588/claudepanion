import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import CompanionAbout from "../../src/client/pages/CompanionAbout";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/companions") return new Response(JSON.stringify([
      { name: "demo", kind: "entity", displayName: "Demo", icon: "✨", description: "Demo companion.", contractVersion: "1", version: "0.1.0", requiredEnv: ["DEMO_TOKEN"] },
    ]), { status: 200 });
    if (url === "/api/companions/demo/preflight") return new Response(JSON.stringify({
      ok: false, missingRequired: ["DEMO_TOKEN"], missingOptional: [],
    }), { status: 200 });
    if (url === "/api/tools/demo") return new Response(JSON.stringify({
      manifest: { name: "demo", kind: "entity", displayName: "Demo", icon: "✨", description: "Demo companion.", contractVersion: "1", version: "0.1.0" },
      tools: [
        { name: "demo_get_thing", description: "Read a thing.", params: [], signature: "demo_get_thing()", sideEffect: "read" },
        { name: "demo_post_thing", description: "Post a thing.", params: [], signature: "demo_post_thing()", sideEffect: "write" },
      ],
    }), { status: 200 });
    throw new Error(`unexpected: ${url}`);
  }));
});
afterEach(() => vi.restoreAllMocks());

describe("CompanionAbout", () => {
  it("renders manifest header", async () => {
    render(
      <MemoryRouter initialEntries={["/c/demo"]}>
        <Routes>
          <Route path="/c/:companion" element={<CompanionAbout />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Demo" })).toBeInTheDocument());
    expect(screen.getByText(/Demo companion/)).toBeInTheDocument();
  });

  it("renders preflight banner when config missing", async () => {
    render(
      <MemoryRouter initialEntries={["/c/demo"]}>
        <Routes>
          <Route path="/c/:companion" element={<CompanionAbout />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("DEMO_TOKEN")).toBeInTheDocument());
  });

  it("groups tools by sideEffect with write tools flagged", async () => {
    render(
      <MemoryRouter initialEntries={["/c/demo"]}>
        <Routes>
          <Route path="/c/:companion" element={<CompanionAbout />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("demo_get_thing")).toBeInTheDocument());
    expect(screen.getAllByText("demo_post_thing").length).toBeGreaterThanOrEqual(2);
    // write warning visible
    expect(screen.getByText(/writes to external systems/i)).toBeInTheDocument();
  });

  it("does NOT show write warning when no write tools", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/companions") return new Response(JSON.stringify([
        { name: "ro", kind: "entity", displayName: "RO", icon: "🔍", description: "", contractVersion: "1", version: "0.1.0" },
      ]), { status: 200 });
      if (url === "/api/companions/ro/preflight") return new Response(JSON.stringify({ ok: true, missingRequired: [], missingOptional: [] }), { status: 200 });
      if (url === "/api/tools/ro") return new Response(JSON.stringify({
        manifest: { name: "ro", kind: "entity", displayName: "RO", icon: "🔍", description: "", contractVersion: "1", version: "0.1.0" },
        tools: [{ name: "ro_get", description: "read", params: [], signature: "ro_get()", sideEffect: "read" }],
      }), { status: 200 });
      throw new Error(`unexpected: ${url}`);
    }));
    render(
      <MemoryRouter initialEntries={["/c/ro"]}>
        <Routes>
          <Route path="/c/:companion" element={<CompanionAbout />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("ro_get")).toBeInTheDocument());
    expect(screen.queryByText(/writes to external systems/i)).not.toBeInTheDocument();
  });
});
