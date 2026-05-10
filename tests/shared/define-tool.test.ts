import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineTool } from "../../src/shared/define-tool.js";
import { successResult } from "../../src/shared/types.js";

describe("defineTool", () => {
  it("infers handler params from the schema", async () => {
    const tool = defineTool({
      name: "test_tool",
      description: "test",
      schema: {
        name: z.string(),
        count: z.number().optional(),
      },
      async handler({ name, count }) {
        return successResult({ greeting: `hi ${name}`, count: count ?? 0 });
      },
    });

    expect(tool.name).toBe("test_tool");
    const result = await tool.handler({ name: "world" });
    expect(result.content[0].text).toContain("hi world");
  });

  it("defaults sideEffect to undefined and propagates 'write'", () => {
    const reader = defineTool({
      name: "r",
      description: "r",
      schema: {},
      async handler() { return successResult({}); },
    });
    expect(reader.sideEffect).toBeUndefined();

    const writer = defineTool({
      name: "w",
      description: "w",
      schema: {},
      sideEffect: "write",
      async handler() { return successResult({}); },
    });
    expect(writer.sideEffect).toBe("write");
  });
});
