import { chromium, type Browser } from "playwright";

import { installEvaluateShim } from "#lib/page-evaluate.ts";

import { captureViewportStitch } from "./capture-viewport-stitch.ts";
import { CURATED_STYLE_PROPERTIES } from "./constants/style-properties.ts";
import type { BrowserDriver, RenderedPage, StitchedCapture, StyleEntry } from "./types.ts";
import { applyViewport, runCapturePreamble, waitForNetworkIdle } from "./utils/create-playwright-driver.ts";
import { measurePrimaryViewport, measureRects } from "./utils/page-scripts.ts";

export function createPlaywrightDriver(): BrowserDriver {
  let browserPromise: Promise<Browser> | undefined;

  function getBrowser(): Promise<Browser> {
    browserPromise ??= chromium.launch();
    return browserPromise;
  }

  return {
    async render({ url, viewports, settleMs, stabilize }): Promise<RenderedPage> {
      const viewportEntries = Object.entries(viewports);
      const [primaryEntry, ...restEntries] = viewportEntries;
      if (!primaryEntry) {
        throw new Error("createPlaywrightDriver: render() requires at least one viewport");
      }
      const [primaryViewport, primarySize] = primaryEntry;

      const browser = await getBrowser();
      const context = await browser.newContext();
      await installEvaluateShim(context);

      await context.addInitScript({
        content: "globalThis.__name = globalThis.__name || function (fn) { return fn; };",
      });

      try {
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);

        const networkUrls: string[] = [];
        page.on("request", (request) => {
          networkUrls.push(request.url());
        });

        await applyViewport(page, cdp, primarySize);
        await page.goto(url, { waitUntil: "load" });
        await waitForNetworkIdle(page);
        await page.waitForTimeout(settleMs);

        await runCapturePreamble(page, primarySize);

        const measurements = await page.evaluate(measurePrimaryViewport, [...CURATED_STYLE_PROPERTIES]);

        const styles: Record<string, StyleEntry> = {};
        for (const { migId, props, rect } of measurements) {
          styles[migId] = { props, rects: { [primaryViewport]: rect } };
        }

        const renderedHtml = await page.content();

        const stitches: Record<string, StitchedCapture> = {
          [primaryViewport]: await captureViewportStitch(page, cdp, primarySize, stabilize),
        };

        for (const [viewport, size] of restEntries) {
          await applyViewport(page, cdp, size);
          await runCapturePreamble(page, size);

          const rects = await page.evaluate(measureRects);
          for (const [migId, rect] of Object.entries(rects)) {
            const entry = styles[migId];
            if (entry) entry.rects[viewport] = rect;
          }

          stitches[viewport] = await captureViewportStitch(page, cdp, size, stabilize);
        }

        return { renderedHtml, styles, stitches, networkUrls };
      } finally {
        await context.close();
      }
    },

    async close(): Promise<void> {
      if (!browserPromise) return;
      const browser = await browserPromise;
      await browser.close();
    },
  };
}
