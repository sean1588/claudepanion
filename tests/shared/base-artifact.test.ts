import { describe, it, expect } from "vitest";
import type { BaseArtifact } from "../../src/shared/types.js";

describe("BaseArtifact", () => {
  it("accepts an artifact with summary, markdown, and errors", () => {
    const a: BaseArtifact = {
      summary: "Did the thing",
      markdown: "## Result\n\nIt worked.",
      errors: ["one warning"],
    };
    expect(a.summary).toBe("Did the thing");
    expect(a.markdown).toContain("Result");
    expect(a.errors).toHaveLength(1);
  });

  it("treats summary, markdown, and errors as optional during transition", () => {
    const a: BaseArtifact = {};
    expect(a.summary).toBeUndefined();
    expect(a.markdown).toBeUndefined();
    expect(a.errors).toBeUndefined();
  });
});
