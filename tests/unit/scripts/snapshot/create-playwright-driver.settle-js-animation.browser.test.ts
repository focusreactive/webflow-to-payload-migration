import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createPlaywrightDriver } from "#snapshot/create-playwright-driver.ts";
import type { BrowserDriver } from "#snapshot/types.ts";

import { hasChromium } from "../../../fixtures/snapshot/chromium-available.ts";

const SETTLED_WIDTH = 240;
const FIXTURE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; }
  .spacer { height: 1200px; background: #eef0f6; }
  #grower { width: ${SETTLED_WIDTH}px; height: 80px; background: #123456; transform-origin: 0 0; }
</style></head><body>
  <div class="spacer"></div>
  <div id="grower" style="transform: scaleX(0.5)"></div>
  <div class="spacer"></div>
  <script>
    const el = document.getElementById("grower");
    let start = null;
    const DURATION = 900;
    const step = (now) => {
      start ??= now;
      const t = Math.min(1, (now - start) / DURATION);
      el.style.transform = "scaleX(" + (0.5 + 0.5 * t) + ")";
      if (t < 1) requestAnimationFrame(step);
    };
    new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          observer.disconnect();
          requestAnimationFrame(step);
        }
      }
    }).observe(el);
  </script>
</body></html>
`;

const PRIMARY = { width: 1440, height: 900, deviceScaleFactor: 1 };
const SECONDARY = { width: 768, height: 1024, deviceScaleFactor: 1 };

describe.skipIf(!hasChromium)("createPlaywrightDriver settling js-driven animations", () => {
  let dir: string;
  let driver: BrowserDriver;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "settle-js-anim-test-"));
    await writeFile(join(dir, "page.html"), FIXTURE_HTML);
    driver = createPlaywrightDriver();
  });

  afterAll(async () => {
    await driver.close();
    await rm(dir, { recursive: true, force: true });
  });

  it(
    "measures every viewport after the inline-style animation stops, not mid-flight",
    { timeout: 120_000 },
    async () => {
      const rendered = await driver.render({
        url: pathToFileURL(join(dir, "page.html")).href,
        viewports: { desktop: PRIMARY, tablet: SECONDARY },
        settleMs: 50,
        stabilize: { freezeMotion: true, neutralizeSticky: true, preScrollRemeasure: true },
      });

      const migId = /id="grower"[^>]* data-mig-id="([^"]+)"/.exec(rendered.renderedHtml)?.[1] ?? "";
      const rects = rendered.styles[migId]?.rects;

      expect(rects?.desktop?.width).toBeCloseTo(SETTLED_WIDTH, 0);
      expect(rects?.tablet?.width).toBeCloseTo(SETTLED_WIDTH, 0);
    },
  );
});
