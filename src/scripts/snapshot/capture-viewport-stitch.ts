import type { CDPSession, Page } from "playwright";

import { planWindows } from "#lib/capture/plan-windows.ts";
import { stitchStrips, type StitchStrip } from "#lib/stitch/stitch-strips.ts";

import {
  CAPTURE_OVERLAP_FRACTION,
  HIDDEN_ATTRIBUTE,
  HIDDEN_STYLE_CSS,
  HIDDEN_STYLE_ID,
  PRE_SCROLL_MAX_STEPS,
  PRE_SCROLL_STEP_DELAY_MS,
  SETTLE_MAX_WAIT_MS,
  SETTLE_STABLE_FRAMES,
  STRIP_SETTLE_MAX_MS,
  STRIP_SETTLE_STABLE_FRAMES,
} from "./constants/capture.ts";
import type { CaptureStabilization, CaptureViewport, StitchedCapture } from "./types.ts";
import { assignStickyOwners, captureStripViaCdp, withFrozenAnimations } from "./utils/capture-viewport-stitch.ts";
import {
  measureDocumentHeight,
  measureStickyElements,
  scrollPageTo,
  setElementsHidden,
  settlePage,
} from "./utils/page-scripts.ts";
import { preScrollPage } from "#lib/capture/page-scripts.ts";

export async function captureViewportStitch(
  page: Page,
  cdp: CDPSession,
  viewport: CaptureViewport,
  stabilize: CaptureStabilization,
): Promise<StitchedCapture> {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: false,
  });

  if (stabilize.preScrollRemeasure) {
    await page.evaluate(preScrollPage, {
      stepPx: Math.max(1, Math.round(viewport.height / 2)),
      stepDelayMs: PRE_SCROLL_STEP_DELAY_MS,
      maxSteps: PRE_SCROLL_MAX_STEPS,
    });
    await page.evaluate(settlePage, { maxWaitMs: SETTLE_MAX_WAIT_MS, stableFrames: SETTLE_STABLE_FRAMES });
  }

  const documentHeight = await page.evaluate(measureDocumentHeight);
  const plans = planWindows({
    documentHeight,
    viewportHeight: viewport.height,
    overlapFraction: CAPTURE_OVERLAP_FRACTION,
  });
  const sticky = stabilize.neutralizeSticky ? await page.evaluate(measureStickyElements) : [];
  const hideByStrip = assignStickyOwners({ sticky, strips: plans, documentHeight });

  const dpr = viewport.deviceScaleFactor;
  const strips: StitchStrip[] = [];

  const runStrips = async (): Promise<void> => {
    for (const plan of plans) {
      await page.evaluate(scrollPageTo, plan.top);
      await page.evaluate(settlePage, { maxWaitMs: STRIP_SETTLE_MAX_MS, stableFrames: STRIP_SETTLE_STABLE_FRAMES });

      const hide = hideByStrip.get(plan.windowIndex) ?? [];
      if (hide.length > 0) {
        await page.evaluate(setElementsHidden, {
          migIds: hide,
          hidden: true,
          attribute: HIDDEN_ATTRIBUTE,
          styleId: HIDDEN_STYLE_ID,
          css: HIDDEN_STYLE_CSS,
        });
      }
      try {
        strips.push({ top: plan.top, buffer: await captureStripViaCdp(cdp) });
      } finally {
        if (hide.length > 0) {
          await page.evaluate(setElementsHidden, {
            migIds: hide,
            hidden: false,
            attribute: HIDDEN_ATTRIBUTE,
            styleId: HIDDEN_STYLE_ID,
            css: HIDDEN_STYLE_CSS,
          });
        }
      }
    }
  };

  if (stabilize.freezeMotion) {
    await withFrozenAnimations(page, runStrips);
  } else {
    await runStrips();
  }

  const buffer = stitchStrips({ strips, documentHeight, viewportWidth: viewport.width, dpr });

  return {
    buffer,
    doc: { width: viewport.width, height: documentHeight },
    dpr,
    pixels: { width: Math.round(viewport.width * dpr), height: Math.round(documentHeight * dpr) },
    stickyRegions: sticky.map((region) => ({ migId: region.migId, rect: region.rect })),
  };
}
