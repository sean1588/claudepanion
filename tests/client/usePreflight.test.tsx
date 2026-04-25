import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePreflight } from "../../src/client/hooks/usePreflight";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/companions/x/preflight") {
      return new Response(JSON.stringify({ ok: false, missingRequired: ["TOKEN"], missingOptional: [] }), { status: 200 });
    }
    if (url === "/api/companions/y/preflight") {
      return new Response(JSON.stringify({ ok: true, missingRequired: [], missingOptional: [] }), { status: 200 });
    }
    if (url === "/api/companions/missing/preflight") {
      return new Response(JSON.stringify({ error: "unknown" }), { status: 404 });
    }
    throw new Error(`unexpected url: ${url}`);
  }));
});
afterEach(() => vi.restoreAllMocks());

describe("usePreflight", () => {
  it("returns missingRequired when env is not set", async () => {
    const { result } = renderHook(() => usePreflight("x"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ok).toBe(false);
    expect(result.current.missingRequired).toEqual(["TOKEN"]);
  });

  it("returns ok:true when no missing env", async () => {
    const { result } = renderHook(() => usePreflight("y"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ok).toBe(true);
  });

  it("treats 404 as ok:true (companion has no preflight requirement)", async () => {
    const { result } = renderHook(() => usePreflight("missing"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ok).toBe(true);
  });
});
