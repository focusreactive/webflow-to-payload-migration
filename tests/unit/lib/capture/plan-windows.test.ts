import { planWindows } from "#lib/capture/plan-windows.ts";

describe("planWindows", () => {
  it("returns a single document-height window when the page fits the viewport", () => {
    expect(planWindows({ documentHeight: 500, viewportHeight: 900, overlapFraction: 0.125 })).toEqual([
      { windowIndex: 0, top: 0, height: 500 },
    ]);
    expect(planWindows({ documentHeight: 900, viewportHeight: 900, overlapFraction: 0.125 })).toEqual([
      { windowIndex: 0, top: 0, height: 900 },
    ]);
  });

  it("tiles tall pages with overlapping windows and snaps the last window to the bottom", () => {
    expect(planWindows({ documentHeight: 3000, viewportHeight: 900, overlapFraction: 0.125 })).toEqual([
      { windowIndex: 0, top: 0, height: 900 },
      { windowIndex: 1, top: 788, height: 900 },
      { windowIndex: 2, top: 1576, height: 900 },
      { windowIndex: 3, top: 2100, height: 900 },
    ]);
  });

  it("keeps consecutive windows overlapping and ends exactly at the document bottom", () => {
    const windows = planWindows({ documentHeight: 10_000, viewportHeight: 900, overlapFraction: 0.125 });
    const tops = windows.map((window) => window.top);
    tops.slice(1).forEach((top, i) => {
      expect(top).toBeLessThan((tops[i] ?? 0) + 900);
    });
    expect((tops.at(-1) ?? 0) + 900).toBe(10_000);
  });
});
