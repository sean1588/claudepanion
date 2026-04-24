import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// @testing-library/dom's waitFor checks `typeof jest !== 'undefined'` to detect
// fake timers. In vitest, jest is not a global, so waitFor falls back to the
// real-timer branch and hangs when fake timers are active. Expose a minimal jest
// shim so waitFor correctly detects and advances vitest fake timers.
(globalThis as any).jest = {
  advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
};

afterEach(() => {
  cleanup();
});
