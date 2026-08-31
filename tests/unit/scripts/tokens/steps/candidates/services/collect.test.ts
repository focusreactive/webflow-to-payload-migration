import { collectBreakpoints, collectFromStyles, type PageStyles } from "#tokens/steps/candidates/services/collect.ts";

function page(route: string, elements: PageStyles["elements"]): PageStyles {
  return { route, elements };
}

describe("collectFromStyles", () => {
  it("keeps every distinct colour as its own entry, skipping transparent and unparsable values", () => {
    const collected = collectFromStyles([
      page("/", {
        "mig-0": { color: "rgb(37, 99, 235)", "background-color": "rgba(0, 0, 0, 0)" },
        "mig-1": { color: "rgb(37, 99, 235)", "background-color": "rgb(255, 255, 255)" },
        "mig-2": { color: "not-a-color" },
      }),
    ]);

    expect(collected.colors).toEqual([
      { value: "rgb(37, 99, 235)", oklch: { l: 0.5461, c: 0.2152, h: 262.8809, alpha: 1 }, usageCount: 2 },
      { value: "rgb(255, 255, 255)", oklch: { l: 1, c: 0, h: 0, alpha: 1 }, usageCount: 1 },
    ]);
  });

  it("counts border-color only when the border is visible", () => {
    const collected = collectFromStyles([
      page("/", {
        "mig-0": { "border-color": "rgb(0, 0, 0)", "border-style": "none", "border-width": "0px" },
        "mig-1": { "border-color": "rgb(0, 0, 0)", "border-style": "solid", "border-width": "1px" },
      }),
    ]);

    expect(collected.colors).toEqual([{ value: "rgb(0, 0, 0)", oklch: { l: 0, c: 0, h: 0, alpha: 1 }, usageCount: 1 }]);
  });

  it("collects numeric categories with px filters and sign rules", () => {
    const collected = collectFromStyles([
      page("/", {
        "mig-0": {
          "font-size": "16px",
          "font-weight": "700",
          "line-height": "normal",
          "letter-spacing": "-0.4px",
          "margin-top": "-8px",
          "padding-left": "24px",
          gap: "16px 24px",
          "border-top-left-radius": "50%",
        },
        "mig-1": { "font-size": "16px", "line-height": "24px", "border-top-left-radius": "8px" },
      }),
    ]);

    expect(collected.fontSizes).toEqual([{ value: 16, usageCount: 2 }]);
    expect(collected.fontWeights.map((entry) => entry.value)).toEqual([700]);
    expect(collected.lineHeights.map((entry) => entry.value)).toEqual([24]);
    expect(collected.letterSpacings.map((entry) => entry.value)).toEqual([-0.4]);
    // 24 is deduplicated across gap and padding-left: one entry, usage 2.
    expect(collected.spacings.map((entry) => [entry.value, entry.usageCount])).toEqual([
      [24, 2],
      [16, 1],
    ]);
    expect(collected.radii.map((entry) => entry.value)).toEqual([8]);
  });

  it("parses box-shadow layers and keeps gradients raw", () => {
    const collected = collectFromStyles([
      page("/", {
        "mig-0": {
          "box-shadow": "rgba(0, 0, 0, 0.1) 0px 1px 2px 0px, rgba(0, 0, 0, 0.06) 0px 4px 6px -1px",
          "background-image": "linear-gradient(rgb(0, 0, 0), rgb(255, 255, 255))",
        },
        "mig-1": { "box-shadow": "rgba(0, 0, 0, 0.2) 0px 2px 4px 0px inset", "background-image": "none" },
      }),
    ]);

    expect(collected.shadows).toHaveLength(2);
    expect(collected.shadows[0]?.layers).toEqual([
      { color: "rgba(0, 0, 0, 0.1)", offsetX: 0, offsetY: 1, blur: 2, spread: 0, inset: false },
      { color: "rgba(0, 0, 0, 0.06)", offsetX: 0, offsetY: 4, blur: 6, spread: -1, inset: false },
    ]);
    expect(collected.shadows[1]?.layers[0]?.inset).toBe(true);
    expect(collected.gradients).toEqual([
      { value: "linear-gradient(rgb(0, 0, 0), rgb(255, 255, 255))", usageCount: 1 },
    ]);
  });

  it("deduplicates a family that appears both quoted and bare in one stack", () => {
    const collected = collectFromStyles([
      page("/", {
        "mig-0": { "font-family": '"system-ui", system-ui, sans-serif' },
        "mig-1": { "font-family": 'system-ui, "system-ui", sans-serif' },
      }),
    ]);

    expect(collected.fontFamilies).toEqual([{ stack: ["system-ui", "sans-serif"], usageCount: 2 }]);
  });
});

describe("collectBreakpoints", () => {
  it("extracts min-width breakpoints from @media preludes, normalizing em to px", () => {
    const css = `
      @media (max-width: 767.98px) { .a { color: red; } }
      @media screen and (min-width: 768px) and (max-width: 991px) { .b { color: blue; } }
      @media (min-width: 48em) { .c { color: green; } }
      @media print { .d { display: none; } }
    `;

    expect(collectBreakpoints([css])).toEqual([{ valuePx: 768, usageCount: 2 }]);
  });
});
