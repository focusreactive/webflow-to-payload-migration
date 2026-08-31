import { describe, expect, it } from "vitest";

import { extrapolateTable } from "#synth/utils/richtext/extrapolate.ts";
import type { RichTextStyleTable } from "#synth/utils/richtext/types.ts";

const measured: RichTextStyleTable = {
  p: { props: { "font-size": "16px", "line-height": "24px", color: "rgb(51,51,51)" }, source: "measured" },
  h2: { props: { "font-size": "32px", "font-weight": "700", color: "rgb(17,17,17)" }, source: "measured" },
};

describe("extrapolateTable", () => {
  const table = extrapolateTable(measured, { scaleRatio: 1.25 });

  it("keeps measured tags untouched", () => {
    expect(table.h2).toBe(measured.h2);
    expect(table.p).toBe(measured.p);
  });

  it("derives h1 above the measured h2 by the scale ratio", () => {
    expect(table.h1?.source).toBe("extrapolated");
    expect(table.h1?.props["font-size"]).toBe("40px"); // round(32 * 1.25)
  });

  it("derives h3 between h2 and paragraph", () => {
    expect(table.h3?.source).toBe("extrapolated");
    const size = Number.parseInt(table.h3?.props["font-size"] ?? "0", 10);
    expect(size).toBeGreaterThan(16);
    expect(size).toBeLessThan(32);
  });

  it("applies inline/link conventions", () => {
    expect(table.strong?.props["font-weight"]).toBe("700");
    expect(table.em?.props["font-style"]).toBe("italic");
    expect(table.a?.props["text-decoration"]).toBe("underline");
    expect(table.ul?.props["list-style-type"]).toBe("disc");
    expect(table.ol?.props["list-style-type"]).toBe("decimal");
  });

  it("never fills img", () => {
    expect(table.img).toBeUndefined();
  });

  it("keeps the heading ladder monotonic and never below body size", () => {
    // Regression: single-nearest-anchor sizing produced h4=19, h5=15, h6=21 for
    // anchors h2=32 / h3=24 / p=17 — h6 ended up larger than h4 and h5.
    const withH3: RichTextStyleTable = {
      p: { props: { "font-size": "17px" }, source: "measured" },
      h2: { props: { "font-size": "32px" }, source: "measured" },
      h3: { props: { "font-size": "24px" }, source: "measured" },
    };
    const full = extrapolateTable(withH3, { scaleRatio: 1.25 });
    const sizes = (["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((tag) =>
      Number.parseFloat(full[tag]?.props["font-size"] ?? "0"),
    );
    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1] as number);
    }
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(17);
  });
});
