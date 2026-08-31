import { assignStickyOwners } from "#snapshot/utils/capture-viewport-stitch.ts";

describe("assignStickyOwners", () => {
  it("assigns each sticky to the strip whose kept band covers its resting y", () => {
    const hide = assignStickyOwners({
      sticky: [
        { migId: "nav", rect: { x: 0, y: 0, width: 100, height: 40 } },
        { migId: "cta", rect: { x: 0, y: 150, width: 100, height: 40 } },
      ],
      strips: [
        { windowIndex: 0, top: 0, height: 200 },
        { windowIndex: 1, top: 100, height: 200 },
      ],
      documentHeight: 300,
    });
    // window 0 contributes only [0, 100) to the stitch, so y=150 belongs to window 1.
    expect(hide.get(0)).toEqual(["cta"]);
    expect(hide.get(1)).toEqual(["nav"]);
  });

  it("keeps a sticky out of a window whose tail is discarded by the stitch", () => {
    // Mirrors the real capture: viewport 900, stride 788, so each window
    // contributes only its first 788 rows and 829 never survives.
    const strips = [
      { windowIndex: 0, top: 0, height: 900 },
      { windowIndex: 1, top: 788, height: 900 },
      { windowIndex: 2, top: 1576, height: 900 },
    ];
    const hide = assignStickyOwners({
      sticky: [{ migId: "banner", rect: { x: 0, y: 829, width: 100, height: 71 } }],
      strips,
      documentHeight: 2476,
    });
    expect(hide.get(0)).toEqual(["banner"]);
    expect(hide.get(1)).toEqual([]);
  });

  it("hides a fixed overlay in every window because it has no document position", () => {
    const hide = assignStickyOwners({
      sticky: [
        { migId: "cookie", position: "fixed", rect: { x: 0, y: 829, width: 100, height: 71 } },
        { migId: "nav", position: "sticky", rect: { x: 0, y: 0, width: 100, height: 40 } },
      ],
      strips: [
        { windowIndex: 0, top: 0, height: 900 },
        { windowIndex: 1, top: 788, height: 900 },
      ],
      documentHeight: 1688,
    });
    expect(hide.get(0)).toEqual(["cookie"]);
    expect(hide.get(1)?.sort()).toEqual(["cookie", "nav"]);
  });
});
