import { isSemanticColorValue, parseSemanticColorValue, semanticColorToCss } from "#lib/semantic-color.ts";

describe("parseSemanticColorValue", () => {
  it("parses an alias to either tier", () => {
    expect(parseSemanticColorValue("{primitive.color.slate-50}")).toEqual({
      kind: "alias",
      ref: { tier: "primitive", name: "slate-50" },
    });
    expect(parseSemanticColorValue("{semantic.color.primary}")).toEqual({
      kind: "alias",
      ref: { tier: "semantic", name: "primary" },
    });
  });

  it("parses a mix against transparent and against another token", () => {
    expect(parseSemanticColorValue("color-mix(in oklab, {primitive.color.white} 70%, transparent)")).toEqual({
      kind: "mix",
      from: { tier: "primitive", name: "white" },
      weightPercent: 70,
      to: "transparent",
    });
    expect(
      parseSemanticColorValue("color-mix(in oklab, {semantic.color.primary} 50%, {primitive.color.ink-900})"),
    ).toEqual({
      kind: "mix",
      from: { tier: "semantic", name: "primary" },
      weightPercent: 50,
      to: { tier: "primitive", name: "ink-900" },
    });
  });

  it("rejects everything outside the two forms", () => {
    for (const value of [
      "rgb(0, 0, 0)",
      "var(--color-white)",
      "{primitive.color.White}",
      "{primitive.spacing.md}",
      "color-mix(in srgb, {primitive.color.white} 70%, transparent)",
      "color-mix(in oklab, {primitive.color.white} 170%, transparent)",
    ]) {
      expect(isSemanticColorValue(value)).toBe(false);
    }
  });
});

describe("semanticColorToCss", () => {
  it("turns references of both tiers into the shared --color-* namespace", () => {
    expect(semanticColorToCss("color-mix(in oklab, {primitive.color.white} 70%, {semantic.color.primary})")).toBe(
      "color-mix(in oklab, var(--color-white) 70%, var(--color-primary))",
    );
  });
});
