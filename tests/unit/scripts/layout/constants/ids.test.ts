import { LAYOUT_STEP_ID, layoutRouteStepId } from "#layout/constants/ids.ts";

describe("layout step ids", () => {
  it("derives a unit step id from the route", () => {
    expect(layoutRouteStepId("/about")).toBe("layout:route:/about");
  });

  it("names the stage-grain step", () => {
    expect(LAYOUT_STEP_ID).toBe("layout");
  });
});
