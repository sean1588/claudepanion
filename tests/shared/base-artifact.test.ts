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

  it("requires summary and markdown (v2 contract)", () => {
    const a: BaseArtifact = { summary: "x", markdown: "y" };
    expect(a.summary).toBe("x");
    expect(a.markdown).toBe("y");
    expect(a.errors).toBeUndefined();
  });
});
