import { describe, it, expect } from "vitest";
import { generateEntityId } from "../../src/server/id";

describe("generateEntityId", () => {
  it("prefixes with companion name and appends 6 hex chars", () => {
    const id = generateEntityId("expense-tracker");
    expect(id).toMatch(/^expense-tracker-[0-9a-f]{6}$/);
  });

  it("generates distinct ids", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateEntityId("x"));
    expect(ids.size).toBe(100);
  });
});
