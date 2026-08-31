import { PNG } from "pngjs";

import { hasChromium } from "../../../fixtures/snapshot/chromium-available.ts";
import { createPlaywrightDriver } from "#snapshot/create-playwright-driver.ts";

const TALL_PAGE =
  "data:text/html,"
  + encodeURIComponent(
    `<body style="margin:0">
       <div id="nav" style="position:fixed;top:0;left:0;width:100%;height:40px;background:#0f0"></div>
       <div style="height:1200px;background:linear-gradient(#f00,#00f)"></div>
     </body>`,
  );

describe.skipIf(!hasChromium)("createPlaywrightDriver: slice+stitch", () => {
  it("returns one full-height stitch per viewport with pixels = doc × dpr", async () => {
    const driver = createPlaywrightDriver();
    try {
      const rendered = await driver.render({
        url: TALL_PAGE,
        viewports: { desktop: { width: 400, height: 300, deviceScaleFactor: 1 } },
        settleMs: 0,
        stabilize: { freezeMotion: true, neutralizeSticky: true, preScrollRemeasure: true },
      });

      const stitch = rendered.stitches["desktop"];
      expect(stitch).toBeDefined();
      if (!stitch) throw new Error("no desktop stitch");

      expect(stitch.pixels.height).toBe(Math.round(stitch.doc.height * stitch.dpr));
      expect(stitch.pixels.height).toBeGreaterThan(300); // taller than one viewport

      const png = PNG.sync.read(stitch.buffer);
      expect(png.width).toBe(stitch.pixels.width);
      expect(png.height).toBe(stitch.pixels.height);
      expect(stitch.stickyRegions.some((region) => region.rect.height === 40)).toBe(true);
    } finally {
      await driver.close();
    }
  }, 60_000);
});
