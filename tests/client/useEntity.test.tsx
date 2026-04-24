import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEntity } from "../../src/client/hooks/useEntity";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useEntity", () => {
  it("fetches once on mount", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "x-1", status: "pending", logs: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useEntity("x", "x-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.entity?.id).toBe("x-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("polls every 2s while status is pending or running", async () => {
    let count = 0;
    const fetchMock = vi.fn(async () => {
      count++;
      return new Response(JSON.stringify({ id: "x-1", status: "running", logs: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() => useEntity("x", "x-1"));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it("stops polling once status is completed", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "x-1", status: "completed", logs: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() => useEntity("x", "x-1"));
    await vi.advanceTimersByTimeAsync(0);
    const before = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchMock.mock.calls.length).toBe(before);
  });
});
