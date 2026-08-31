import { describe, expect, it } from "vitest";

import type { ColorCandidate } from "#synth/utils/richtext/color-match.ts";
import { styleTableFromMeasured } from "#synth/utils/richtext/extract-styles.ts";

describe("styleTableFromMeasured", () => {
  it("keeps only the properties relevant to each tag's category", () => {
    const table = styleTableFromMeasured(
      {
        h2: { "font-size": "32px", "font-weight": "700", width: "600px" },
        p: { "font-size": "16px" },
      },
      [],
    );
    expect(table.h2?.source).toBe("measured");
    expect(table.h2?.props["font-size"]).toBe("32px");
    expect(table.h2?.props["font-weight"]).toBe("700");
    // width is not in RELEVANT_PROPS for headings → excluded even if present
    expect(table.h2?.props.width).toBeUndefined();
    expect(table.p?.props["font-size"]).toBe("16px");
  });

  it("resolves colors down to the closest design token", () => {
    const candidates: ColorCandidate[] = [{ varName: "--color-ink", rgba: { r: 17, g: 17, b: 17, a: 1 } }];
    const table = styleTableFromMeasured({ p: { color: "rgb(17, 17, 17)" } }, candidates);
    expect(table.p?.props.color).toBe("var(--color-ink)");
  });

  it("falls back to the verbatim value when no color candidate is close enough", () => {
    const table = styleTableFromMeasured({ p: { color: "rgb(200, 30, 40)" } }, []);
    expect(table.p?.props.color).toBe("rgb(200, 30, 40)");
  });

  it("drops unsupported and image tags", () => {
    expect(styleTableFromMeasured({ span: { color: "red" }, img: { "font-size": "16px" } }, [])).toEqual({});
  });

  it("returns an empty table for empty input", () => {
    expect(styleTableFromMeasured({}, [])).toEqual({});
  });
});
