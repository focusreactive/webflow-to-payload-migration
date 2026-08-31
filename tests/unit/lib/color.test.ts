import { colorsClose, parseColor, type Rgba } from "#lib/color.ts";

function parse(value: string): Rgba {
  const parsed = parseColor(value);
  if (parsed === null) throw new Error(`unparsable color: ${value}`);
  return parsed;
}

describe("parseColor", () => {
  it("parses rgb/rgba with comma and space syntax", () => {
    expect(parseColor("rgb(0, 0, 0)")).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(parseColor("rgba(136, 158, 168, 0.2)")).toEqual({ r: 136, g: 158, b: 168, a: 0.2 });
    expect(parseColor("rgb(0 0 0 / 50%)")).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
  });

  it("maps transparent to zero alpha", () => {
    expect(parseColor("transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it("converts oklch to sRGB", () => {
    // oklch(0 0 0) is pure black.
    expect(parseColor("oklch(0 0 0)")).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    // oklch(1 0 0) is pure white.
    expect(parseColor("oklch(1 0 0)")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it("returns null for unrecognized syntax", () => {
    expect(parseColor("not-a-color")).toBeNull();
  });
});

describe("colorsClose", () => {
  // Theme tokens (oklch) paired with the rgb values a live Webflow site reports
  // for the same color.
  const cases: Array<[string, string, string]> = [
    ["black", "rgb(0, 0, 0)", "oklch(0 0 0)"],
    ["white", "rgb(255, 255, 255)", "oklch(1 0 0)"],
    ["surface-muted", "rgb(238, 240, 246)", "oklch(0.9553 0.0083 271.3273)"],
    ["slate", "rgb(98, 109, 134)", "oklch(0.5349 0.0416 266.3633)"],
    ["border-muted", "rgba(136, 158, 168, 0.2)", "oklch(0.6855 0.0288 226.9782 / 0.2)"],
  ];

  for (const [name, rgb, oklch] of cases) {
    it(`treats ${name} rgb and oklch as close`, () => {
      expect(colorsClose(parse(rgb), parse(oklch))).toBe(true);
    });
  }

  it("still flags genuinely different colors", () => {
    expect(colorsClose(parse("rgb(0, 0, 0)"), parse("oklch(1 0 0)"))).toBe(false);
    expect(colorsClose(parse("rgb(238, 240, 246)"), parse("rgb(10, 10, 10)"))).toBe(false);
  });

  it("treats both sides fully transparent as close regardless of channels", () => {
    expect(colorsClose({ r: 0, g: 0, b: 0, a: 0 }, { r: 255, g: 255, b: 255, a: 0 })).toBe(true);
  });
});
