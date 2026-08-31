import type { CDPSession, Page } from "playwright";

import { preScrollPage } from "#lib/capture/page-scripts.ts";

import {
  NETWORK_IDLE_TIMEOUT_MS,
  PRE_SCROLL_MAX_STEPS,
  PRE_SCROLL_STEP_DELAY_MS,
  SCROLL_TOP_SETTLE_MS,
  SCROLL_TOP_STABLE_FRAMES,
  SETTLE_MAX_WAIT_MS,
  SETTLE_STABLE_FRAMES,
} from "../constants/capture.ts";
import type { CaptureViewport } from "../types.ts";

import { scrollPageTo, settlePage } from "./page-scripts.ts";

export async function applyViewport(page: Page, cdp: CDPSession, viewport: CaptureViewport): Promise<void> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: false,
  });
}

export async function waitForNetworkIdle(page: Page): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", {
      timeout: NETWORK_IDLE_TIMEOUT_MS,
    });
  } catch {
    return;
  }
}

export async function runCapturePreamble(page: Page, viewport: CaptureViewport): Promise<void> {
  await page.evaluate(preScrollPage, {
    stepPx: Math.max(1, Math.round(viewport.height / 2)),
    stepDelayMs: PRE_SCROLL_STEP_DELAY_MS,
    maxSteps: PRE_SCROLL_MAX_STEPS,
  });
  await waitForNetworkIdle(page);
  await page.evaluate(settlePage, {
    maxWaitMs: SETTLE_MAX_WAIT_MS,
    stableFrames: SETTLE_STABLE_FRAMES,
  });
  await page.evaluate(scrollPageTo, 0);
  await page.evaluate(settlePage, {
    maxWaitMs: SCROLL_TOP_SETTLE_MS,
    stableFrames: SCROLL_TOP_STABLE_FRAMES,
  });
}
