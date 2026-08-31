import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { PNG } from "pngjs";

import { createPlaywrightDriver } from "#snapshot/create-playwright-driver.ts";
import type { BrowserDriver } from "#snapshot/types.ts";

import { hasChromium } from "../../../fixtures/snapshot/chromium-available.ts";

const ANIM_INITIAL_RGB = [200, 30, 30] as const;
const ANIM_LOOPED_RGB = [30, 30, 200] as const;

const FIXTURE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; }
  .header { position: fixed; top: 0; left: 0; right: 0; height: 60px; background: #123456; color: #fff; }
  .a { height: 800px; background: #e8f0fe; }
  .spacer { height: 1400px; background: #ffffff; }
  .b { height: 700px; background: #fef3e8; animation: fade 0.2s ease-in; }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  .lazy { height: 40px; background: #e8fee8; overflow: hidden; }
  .lazy.revealed { height: 300px; }
  .anim-box {
    position: absolute; top: 100px; left: 20px; width: 40px; height: 40px;
    animation: cycle 1s linear infinite;
  }
  @keyframes cycle {
    0% { background-color: rgb(${ANIM_INITIAL_RGB.join(",")}); }
    100% { background-color: rgb(${ANIM_LOOPED_RGB.join(",")}); }
  }
</style></head><body>
  <div class="header">fixed header</div>
  <div class="a">section a</div>
  <div id="anim-box" class="anim-box"></div>
  <div class="spacer"></div>
  <div class="b">section b</div>
  <div id="lazy" class="lazy">lazy content</div>
  <script>
    const lazy = document.getElementById("lazy");
    new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          lazy.classList.add("revealed");
          observer.disconnect();
        }
      }
    }).observe(lazy);
  </script>
</body></html>
`;

const VIEWPORT = { width: 800, height: 600, deviceScaleFactor: 2 };

describe.skipIf(!hasChromium)("createPlaywrightDriver (real chromium)", () => {
  let dir: string;
  let driver: BrowserDriver;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "capture-browser-test-"));
    await writeFile(join(dir, "page.html"), FIXTURE_HTML);
    driver = createPlaywrightDriver();
  });

  afterAll(async () => {
    await driver.close();
    await rm(dir, { recursive: true, force: true });
  });

  it(
    "reveals lazy content via pre-scroll, freezes infinite animations at their initial frame, and keeps visibility bookkeeping out of rendered html",
    { timeout: 60_000 },
    async () => {
      const rendered = await driver.render({
        url: pathToFileURL(join(dir, "page.html")).href,
        viewports: { desktop: VIEWPORT },
        settleMs: 50,
        stabilize: { freezeMotion: true, neutralizeSticky: true, preScrollRemeasure: true },
      });

      const lazyMigId = /id="lazy"[^>]* data-mig-id="([^"]+)"/.exec(rendered.renderedHtml)?.[1];
      expect(lazyMigId).toBeDefined();
      expect(rendered.styles[lazyMigId ?? ""]?.rects.desktop?.height).toBe(300);

      expect(rendered.renderedHtml).not.toContain("data-mig-visibility");
      expect(rendered.renderedHtml).toContain("data-mig-id");

      const stitch = rendered.stitches["desktop"];
      expect(stitch).toBeDefined();
      const png = PNG.sync.read(stitch?.buffer ?? Buffer.alloc(0));
      const deviceX = 40 * VIEWPORT.deviceScaleFactor;
      const deviceY = 120 * VIEWPORT.deviceScaleFactor;
      const pixelIndex = (deviceY * png.width + deviceX) * 4;
      const sampledRgb = [png.data[pixelIndex], png.data[pixelIndex + 1], png.data[pixelIndex + 2]];
      expect(sampledRgb).toEqual([...ANIM_INITIAL_RGB]);
    },
  );
});
