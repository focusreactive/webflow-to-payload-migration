import { designTokensArtifact } from "#tokens/schemas/design-tokens.ts";
import { assembleDesignTokens, toDtcgColor } from "#tokens/steps/accept/services/assemble.ts";

import { candidates, response } from "../../../fixtures/tokens.ts";

describe("assembleDesignTokens", () => {
  it("names every primitive from the response and validates against the artifact schema", () => {
    const data = assembleDesignTokens({ candidates: candidates(), response: response() });

    expect(() => designTokensArtifact.dataSchema.parse(data)).not.toThrow();
    expect(Object.keys(data.primitive.color)).toEqual(["ink-900", "paper-50"]);
    expect(data.primitive.color["ink-900"]?.$value.hex).toBe("#141b2a");
    expect(Object.keys(data.primitive.fontSize)).toEqual(["base", "lg"]);
    expect(data.primitive.spacing["md"]?.$value).toEqual({ value: 16, unit: "px" });
    expect(data.primitive.breakpoint["xl"]?.$value).toEqual({ value: 1200, unit: "px" });
  });

  it("carries role values through verbatim, including the translucent one", () => {
    const data = assembleDesignTokens({ candidates: candidates(), response: response() });

    expect(data.semantic.color).toEqual({
      surface: { $type: "color", $value: "{primitive.color.paper-50}" },
      scrim: { $type: "color", $value: "color-mix(in oklab, {primitive.color.paper-50} 70%, transparent)" },
    });
    // The translucent candidate is covered by a role, so it never becomes a primitive.
    expect(Object.keys(data.primitive.color)).not.toContain("scrim");
  });

  it("assembles the shadow layers into DTCG values", () => {
    const data = assembleDesignTokens({ candidates: candidates(), response: response() });

    expect(data.primitive.shadow["md"]?.$value).toEqual([
      {
        color: toDtcgColor("rgba(0, 0, 0, 0.1)"),
        offsetX: { value: 0, unit: "px" },
        offsetY: { value: 4, unit: "px" },
        blur: { value: 12, unit: "px" },
        spread: { value: 0, unit: "px" },
        inset: false,
      },
    ]);
  });

  it("produces empty groups for an empty run", () => {
    const empty = { ...candidates(), colors: [], fontSizes: [], spacings: [] };
    const emptyResponse = {
      ...response(),
      colors: { primitives: [], roles: [] },
      fontSizes: [],
      spacings: [],
    };

    const data = assembleDesignTokens({ candidates: empty, response: emptyResponse });
    expect(data.primitive.color).toEqual({});
    expect(data.semantic.color).toEqual({});
    expect(data.primitive.spacing).toEqual({});
  });
});
