import { describe, expect, it } from "vitest";

import { CONFIDENCE_THRESHOLD, decideVerdict, type PlatformScore } from "#detect/scoring.ts";

function score(value: number, hasTier1Strong: boolean): PlatformScore {
  return { score: value, hasTier1Strong, signals: [] };
}

describe("decideVerdict", () => {
  it("returns webflow when the score clears the threshold on a tier-1 strong signal", () => {
    expect(decideVerdict({ webflow: score(CONFIDENCE_THRESHOLD, true) })).toBe("webflow");
  });

  it("returns unknown below the threshold", () => {
    expect(decideVerdict({ webflow: score(CONFIDENCE_THRESHOLD - 1, true) })).toBe("unknown");
  });

  it("returns unknown without a tier-1 strong signal, however high the score", () => {
    expect(decideVerdict({ webflow: score(CONFIDENCE_THRESHOLD * 3, false) })).toBe("unknown");
  });
});
