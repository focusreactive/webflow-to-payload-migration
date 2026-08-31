import { computeBoundaries } from "#discovery/utils/compute-boundaries.ts";

const ELEMENTS = {
  "mig-1": {
    desktop: { rect: { x: 10, y: 100, width: 200, height: 50 } },
    mobile: { rect: { x: 0, y: 80, width: 100, height: 40 } },
  },
  "mig-2": { desktop: { rect: { x: 20, y: 120, width: 300, height: 90 } } },
};

describe("computeBoundaries", () => {
  it("unions member rects per viewport and omits viewports with no member rect", () => {
    expect(computeBoundaries(["mig-1", "mig-2"], ELEMENTS)).toEqual({
      desktop: { rect: { x: 10, y: 100, width: 310, height: 110 } },
      mobile: { rect: { x: 0, y: 80, width: 100, height: 40 } },
    });
  });

  it("skips node ids absent from the stitch index", () => {
    expect(computeBoundaries(["mig-404"], ELEMENTS)).toEqual({});
  });
});
