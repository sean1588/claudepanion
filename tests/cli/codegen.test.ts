import { describe, it, expect } from "vitest";
import { renderCompanionIndex, renderRegistryIndex, renderClientIndex } from "../../src/cli/codegen.js";

describe("codegen", () => {
  it("renderCompanionIndex emits exports binding manifest + tools", () => {
    const out = renderCompanionIndex({ slug: "my-thing", camelCase: "myThing" });
    expect(out).toContain('import { manifest } from "./manifest.js";');
    expect(out).toContain('import { tools } from "./server/tools.js";');
    expect(out).toContain('export const myThing: RegisteredCompanion = { manifest, tools };');
    expect(out).toContain("// AUTO-GENERATED");
  });

  it("renderRegistryIndex emits alphabetical-by-slug array", () => {
    const out = renderRegistryIndex([
      { slug: "zebra", camelCase: "zebra" },
      { slug: "alpha", camelCase: "alpha" },
    ]);
    expect(out.indexOf('"./alpha/index.js"')).toBeLessThan(out.indexOf('"./zebra/index.js"'));
    expect(out).toContain("export const companions: RegisteredCompanion[] = [alpha, zebra];");
  });

  it("renderClientIndex registers null for missing override files", () => {
    const out = renderClientIndex([
      { slug: "alpha", camelCase: "alpha", hasForm: true, hasDetail: false, hasList: false },
    ]);
    expect(out).toContain('import AlphaForm from "./alpha/form";');
    expect(out).not.toContain('import AlphaDetail');
    expect(out).toContain('"alpha": AlphaForm');
  });
});
