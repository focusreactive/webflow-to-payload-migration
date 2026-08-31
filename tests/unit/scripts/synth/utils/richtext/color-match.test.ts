import { describe, expect, it } from "vitest";

import type { DesignTokensData } from "#tokens/schemas/design-tokens.ts";
import { buildColorCandidates, resolveColor } from "#synth/utils/richtext/color-match.ts";

function colorToken(hex: string) {
  return {
    $type: "color" as const,
    $value: { colorSpace: "oklch" as const, components: [0, 0, 0] as [number, number, number], alpha: 1, hex },
  };
}
const tokens = {
  primitive: {
    color: { primary: colorToken("#111111"), surface: colorToken("#ffffff") },
    fontFamily: {},
    fontSize: {},
    fontWeight: {},
    lineHeight: {},
    letterSpacing: {},
    spacing: {},
    radius: {},
    shadow: {},
    breakpoint: {},
  },
  semantic: {
    color: {
      accent: { $type: "color" as const, $value: "{primitive.color.primary}" },
      veil: { $type: "color" as const, $value: "color-mix(in oklab, {primitive.color.surface} 50%, transparent)" },
    },
  },
} as unknown as DesignTokensData;

describe("resolveColor", () => {
  const candidates = buildColorCandidates(tokens);
  it("snaps a near-exact measured color to the token var", () => {
    expect(resolveColor("rgb(253, 254, 255)", candidates)).toBe("var(--color-surface)");
  });
  it("resolves semantic roles to their own var name", () => {
    // accent aliases primary (#111111); both are in-tolerance, tie broken by name sort → accent < primary
    expect(resolveColor("rgb(17, 17, 17)", candidates)).toBe("var(--color-accent)");
  });
  it("falls back to the verbatim measured value when no token is within tolerance", () => {
    expect(resolveColor("rgb(200, 30, 40)", candidates)).toBe("rgb(200, 30, 40)");
  });
});

describe("buildColorCandidates", () => {
  it("resolves a color-mix role instead of dropping it", () => {
    const veil = buildColorCandidates(tokens).find((candidate) => candidate.varName === "--color-veil");

    // 50% of opaque white against transparent: white at half alpha.
    expect(veil?.rgba).toEqual({ r: 255, g: 255, b: 255, a: 0.5 });
  });
});
