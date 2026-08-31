import type { CDPSession, Page } from "playwright";

import {
  freezeAnimationsInPage,
  unfreezeAnimationsInPage,
  FREEZE_ANIMATIONS_STYLE_ID,
} from "#lib/capture/page-scripts.ts";

import type { Rect, StickyPosition } from "../types.ts";

export function assignStickyOwners(opts: {
  sticky: { migId: string; rect: Rect; position?: StickyPosition }[];
  strips: { windowIndex: number; top: number; height: number }[];
  documentHeight?: number;
}): Map<number, string[]> {
  const ordered = [...opts.strips].sort((a, b) => a.top - b.top);
  const last = ordered[ordered.length - 1];
  const documentEnd = opts.documentHeight ?? (last !== undefined ? last.top + last.height : 0);

  const keptEnd = (index: number): number => ordered[index + 1]?.top ?? documentEnd;

  const ownerOf = new Map<string, number>();
  for (const region of opts.sticky) {
    if (region.position === "fixed") continue;
    const owner =
      ordered.find((strip, index) => region.rect.y >= strip.top && region.rect.y < keptEnd(index)) ?? ordered[0];
    if (owner) ownerOf.set(region.migId, owner.windowIndex);
  }

  const hideByStrip = new Map<number, string[]>();
  for (const strip of ordered) {
    hideByStrip.set(
      strip.windowIndex,
      opts.sticky.filter((region) => ownerOf.get(region.migId) !== strip.windowIndex).map((region) => region.migId),
    );
  }
  return hideByStrip;
}

export async function withFrozenAnimations<T>(page: Page, run: () => Promise<T>): Promise<T> {
  await page.evaluate(freezeAnimationsInPage, FREEZE_ANIMATIONS_STYLE_ID);
  try {
    return await run();
  } finally {
    await page.evaluate(unfreezeAnimationsInPage, FREEZE_ANIMATIONS_STYLE_ID);
  }
}

export async function captureStripViaCdp(cdp: CDPSession): Promise<Buffer> {
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  return Buffer.from(data, "base64");
}
