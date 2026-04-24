import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusPill from "../../src/client/components/StatusPill";

describe("StatusPill", () => {
  it.each(["pending", "running", "completed", "error"] as const)("renders %s with matching class", (s) => {
    render(<StatusPill status={s} />);
    const el = screen.getByText(s);
    expect(el.className).toContain(s);
  });
});
