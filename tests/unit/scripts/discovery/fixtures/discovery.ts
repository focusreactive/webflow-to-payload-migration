import type { StitchIndexData } from "#ir/stitch.ts";

export const STITCH: StitchIndexData = {
  route: "/",
  url: "https://e.com/",
  capturedAt: "2026-07-21T00:00:00.000Z",
  stitches: {},
  elements: {
    "mig-5": { desktop: { rect: { x: 0, y: 100, width: 1440, height: 500 } } },
  },
};

export const NEVER_EXCLUDED = (): boolean => false;
