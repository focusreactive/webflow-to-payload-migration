import { GATE_NAMES, generateGateStepId, GENERATE_SCAFFOLD_STEP_ID } from "#generate/steps.ts";

describe("generate step ids", () => {
  it("names units by the <stage>:<unit> convention", () => {
    expect(GENERATE_SCAFFOLD_STEP_ID).toBe("generate:scaffold");
    expect(generateGateStepId("build")).toBe("generate:build");
  });

  it("orders gates install -> types -> importmap -> seed -> build -> lint", () => {
    expect(GATE_NAMES).toEqual(["install", "types", "importmap", "seed", "build", "lint"]);
  });
});
