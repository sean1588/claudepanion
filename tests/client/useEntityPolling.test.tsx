import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useEntityPolling } from "../../src/client/hooks/useEntityPolling";

describe("useEntityPolling", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("fetches once on mount and again every 2s while running", async () => {
    const fetchEntity = vi.fn().mockResolvedValue({ id: "x", companion: "build", status: "running", logs: [] });
    const { result } = renderHook(() => useEntityPolling("build", "x", { fetchEntity }));

    await waitFor(() => expect(fetchEntity).toHaveBeenCalledTimes(1));
    await act(async () => { vi.advanceTimersByTime(2000); });
    await waitFor(() => expect(fetchEntity).toHaveBeenCalledTimes(2));
    expect(result.current.entity?.status).toBe("running");
  });

  it("stops polling when entity reaches completed", async () => {
    const fetchEntity = vi.fn()
      .mockResolvedValueOnce({ id: "x", companion: "build", status: "running", logs: [] })
      .mockResolvedValueOnce({ id: "x", companion: "build", status: "completed", logs: [] });
    renderHook(() => useEntityPolling("build", "x", { fetchEntity }));

    await waitFor(() => expect(fetchEntity).toHaveBeenCalledTimes(1));
    await act(async () => { vi.advanceTimersByTime(2000); });
    await waitFor(() => expect(fetchEntity).toHaveBeenCalledTimes(2));
    await act(async () => { vi.advanceTimersByTime(10000); });
    expect(fetchEntity).toHaveBeenCalledTimes(2);
  });
});
