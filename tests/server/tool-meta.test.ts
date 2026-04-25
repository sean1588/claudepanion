import { describe, it, expect } from "vitest";
import { z } from "zod";
import type { CompanionToolDefinition } from "../../src/shared/types";
import { successResult, errorResult } from "../../src/shared/types";

describe("CompanionToolDefinition", () => {
  it("handler receives typed params and returns McpToolResult", async () => {
    const tool: CompanionToolDefinition<{ x: number }> = {
      name: "test_double",
      description: "doubles x",
      schema: { x: z.number().describe("value to double") },
      async handler({ x }) {
        return successResult({ result: x * 2 });
      },
    };
    const result = await tool.handler({ x: 3 });
    expect(JSON.parse(result.content[0].text)).toEqual({ result: 6 });
    expect(result.isError).toBeUndefined();
  });

  it("errorResult sets isError flag", () => {
    const r = errorResult("something went wrong");
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe("something went wrong");
  });

  it("successResult serializes objects as JSON", () => {
    const r = successResult({ id: "abc", status: "running" });
    expect(JSON.parse(r.content[0].text)).toEqual({ id: "abc", status: "running" });
  });

  it("successResult passes strings through as-is", () => {
    const r = successResult("hello");
    expect(r.content[0].text).toBe("hello");
  });
});
