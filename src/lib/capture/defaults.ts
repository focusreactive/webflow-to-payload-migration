export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor: number;
}

// A record rather than a single viewport: every consumer downstream — the stitcher, the window
// planner, the preflight dpr check — is written against a set, and keeping the shape means the
// public tool drops to one viewport without touching any of them.
export const VIEWPORTS: Record<string, Viewport> = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};

export const SETTLE_MS = 6000;
