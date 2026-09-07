import { parseGateName } from "#generate/utils/parse-gate-name.ts";

describe("parseGateName", () => {
  it("accepts valid gate names from GATE_NAMES", () => {
    expect(parseGateName("install")).toBe("install");
    expect(parseGateName("types")).toBe("types");
    expect(parseGateName("build")).toBe("build");
  });

  it("rejects invalid gate names", () => {
    expect(() => parseGateName("invalid")).toThrow(/--gate must be one of:/);
  });
});
