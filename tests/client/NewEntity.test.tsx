import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import NewEntity from "../../src/client/pages/NewEntity";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/companions") {
      return new Response(JSON.stringify([
        { name: "build", kind: "entity", displayName: "Build", icon: "🔨", description: "", contractVersion: "1", version: "0.1.0" },
      ]), { status: 200 });
    }
    if (url === "/api/entities" && init?.method === "POST") {
      return new Response(JSON.stringify({ id: "build-aaa111", companion: "build", status: "pending", input: JSON.parse(String(init.body)).input, logs: [], createdAt: "", updatedAt: "", statusMessage: null, artifact: null, errorMessage: null, errorStack: null }), { status: 201 });
    }
    throw new Error(`unexpected ${url}`);
  }));
});
afterEach(() => vi.restoreAllMocks());

describe("NewEntity", () => {
  it("renders the companion's form and navigates to detail on submit", async () => {
    render(
      <MemoryRouter initialEntries={["/c/build/new"]}>
        <Routes>
          <Route path="/c/:companion/new" element={<NewEntity />} />
          <Route path="/c/:companion/:id" element={<div>detail-page</div>} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByLabelText(/companion name/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/companion name/i), { target: { value: "my-companion" } });
    fireEvent.change(screen.getByLabelText(/^description$/i), { target: { value: "a test companion" } });
    fireEvent.click(screen.getByRole("button", { name: /scaffold companion/i }));
    await waitFor(() => expect(screen.getByText("detail-page")).toBeInTheDocument());
  });
});
