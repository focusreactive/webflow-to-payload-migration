import { describe, expect, it } from "vitest";

import { CURATED_STYLE_PROPERTIES } from "#snapshot/constants/style-properties.ts";

describe("CURATED_STYLE_PROPERTIES", () => {
  it("captures richtext-specific inline/list properties", () => {
    expect(CURATED_STYLE_PROPERTIES).toContain("text-decoration");
    expect(CURATED_STYLE_PROPERTIES).toContain("font-style");
    expect(CURATED_STYLE_PROPERTIES).toContain("list-style-type");
  });

  it("has at least 40 unique properties", () => {
    expect(CURATED_STYLE_PROPERTIES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(CURATED_STYLE_PROPERTIES).size).toBe(CURATED_STYLE_PROPERTIES.length);
  });
});
