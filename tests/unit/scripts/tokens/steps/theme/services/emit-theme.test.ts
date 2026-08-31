import { assembleDesignTokens } from "#tokens/steps/accept/services/assemble.ts";
import { emitThemeCss } from "#tokens/steps/theme/services/emit-theme.ts";

import { candidates, response } from "../../../fixtures/tokens.ts";

describe("emitThemeCss", () => {
  it("emits a deterministic @theme block per the P07 namespace mapping", () => {
    const data = assembleDesignTokens({ candidates: candidates(), response: response() });

    expect(emitThemeCss(data)).toBe(`@theme {
  --color-ink-900: oklch(0.223 0.0313 264.7732);
  --color-paper-50: oklch(1 0 0);
  --color-scrim: color-mix(in oklab, var(--color-paper-50) 70%, transparent);
  --color-surface: var(--color-paper-50);
  --font-sans: Inter, sans-serif;
  --text-base: 16px;
  --text-lg: 24px;
  --font-weight-bold: 700;
  --leading-normal: 24px;
  --tracking-tight: -0.4px;
  --spacing-lg: 24px;
  --spacing-md: 16px;
  --spacing-sm: 8px;
  --radius-md: 8px;
  --shadow-md: 0px 4px 12px 0px oklch(0 0 0 / 0.1);
  --breakpoint-md: 768px;
  --breakpoint-xl: 1200px;
}
`);
  });

  it("quotes font families with spaces", () => {
    const withSpaces = candidates();
    withSpaces.fontFamilies = [{ id: "font-family-1", stack: ["Helvetica Neue", "sans-serif"], usageCount: 1 }];

    const css = emitThemeCss(assembleDesignTokens({ candidates: withSpaces, response: response() }));
    expect(css).toContain('--font-sans: "Helvetica Neue", sans-serif;');
  });

  it("emits an empty block for empty data", () => {
    const empty = {
      ...candidates(),
      colors: [],
      fontFamilies: [],
      fontSizes: [],
      fontWeights: [],
      lineHeights: [],
      letterSpacings: [],
      spacings: [],
      radii: [],
      shadows: [],
      breakpoints: [],
    };
    const emptyResponse = {
      colors: { primitives: [], roles: [] },
      fontFamilies: [],
      fontSizes: [],
      fontWeights: [],
      lineHeights: [],
      letterSpacings: [],
      spacings: [],
      radii: [],
      shadows: [],
      breakpoints: [],
    };

    expect(emitThemeCss(assembleDesignTokens({ candidates: empty, response: emptyResponse }))).toBe("@theme {}\n");
  });
});
