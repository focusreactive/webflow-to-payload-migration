import type { TokensResponse } from "#tokens/schemas/judgement-response-schema.ts";
import type { TokenCandidatesData } from "#tokens/schemas/token-candidates.ts";

export function candidates(): TokenCandidatesData {
  return {
    colors: [
      {
        id: "color-1",
        value: "rgb(20, 27, 42)",
        oklch: { l: 0.223, c: 0.0313, h: 264.7732, alpha: 1 },
        usageCount: 40,
      },
      { id: "color-2", value: "rgb(255, 255, 255)", oklch: { l: 1, c: 0, h: 0, alpha: 1 }, usageCount: 20 },
      {
        id: "color-3",
        value: "rgba(255, 255, 255, 0.7)",
        oklch: { l: 1, c: 0, h: 0, alpha: 0.7 },
        usageCount: 5,
      },
    ],
    fontFamilies: [{ id: "font-family-1", stack: ["Inter", "sans-serif"], usageCount: 30 }],
    fontSizes: [
      { id: "font-size-1", value: 16, usageCount: 25 },
      { id: "font-size-2", value: 24, usageCount: 6 },
    ],
    fontWeights: [{ id: "font-weight-1", value: 700, usageCount: 12 }],
    lineHeights: [{ id: "line-height-1", value: 24, usageCount: 18 }],
    letterSpacings: [{ id: "letter-spacing-1", value: -0.4, usageCount: 4 }],
    spacings: [
      { id: "spacing-1", value: 8, usageCount: 30 },
      { id: "spacing-2", value: 16, usageCount: 22 },
      { id: "spacing-3", value: 24, usageCount: 9 },
    ],
    radii: [{ id: "radius-1", value: 8, usageCount: 11 }],
    shadows: [
      {
        id: "shadow-1",
        value: "rgba(0, 0, 0, 0.1) 0px 4px 12px 0px",
        layers: [{ color: "rgba(0, 0, 0, 0.1)", offsetX: 0, offsetY: 4, blur: 12, spread: 0, inset: false }],
        usageCount: 3,
      },
    ],
    breakpoints: [
      { id: "breakpoint-1", valuePx: 768, usageCount: 9 },
      { id: "breakpoint-2", valuePx: 1200, usageCount: 4 },
    ],
    gradients: [{ value: "linear-gradient(rgb(0, 0, 0), rgb(255, 255, 255))", usageCount: 1 }],
  };
}

export function response(): TokensResponse {
  return {
    colors: {
      primitives: [
        { candidateId: "color-1", name: "ink-900" },
        { candidateId: "color-2", name: "paper-50" },
      ],
      roles: [
        { name: "surface", value: "{primitive.color.paper-50}", candidateId: "" },
        {
          name: "scrim",
          value: "color-mix(in oklab, {primitive.color.paper-50} 70%, transparent)",
          candidateId: "color-3",
        },
      ],
    },
    fontFamilies: [{ candidateId: "font-family-1", name: "sans" }],
    fontSizes: [
      { candidateId: "font-size-1", name: "base" },
      { candidateId: "font-size-2", name: "lg" },
    ],
    fontWeights: [{ candidateId: "font-weight-1", name: "bold" }],
    lineHeights: [{ candidateId: "line-height-1", name: "normal" }],
    letterSpacings: [{ candidateId: "letter-spacing-1", name: "tight" }],
    spacings: [
      { candidateId: "spacing-1", name: "sm" },
      { candidateId: "spacing-2", name: "md" },
      { candidateId: "spacing-3", name: "lg" },
    ],
    radii: [{ candidateId: "radius-1", name: "md" }],
    shadows: [{ candidateId: "shadow-1", name: "md" }],
    breakpoints: [
      { candidateId: "breakpoint-1", name: "md" },
      { candidateId: "breakpoint-2", name: "xl" },
    ],
  };
}
