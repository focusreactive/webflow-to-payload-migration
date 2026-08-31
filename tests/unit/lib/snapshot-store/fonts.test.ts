import { FONT_ASSETS_DIR, rewriteFontUrls } from "#lib/snapshot-store/fonts.ts";

describe("rewriteFontUrls", () => {
  it("rewrites the mirror-relative prefix to the app's font route", () => {
    const css = `@font-face {\n  src: url("../${FONT_ASSETS_DIR}/inter.woff2") format("woff2");\n}`;

    expect(rewriteFontUrls(css, "/fonts/")).toContain('url("/fonts/inter.woff2")');
  });

  it("leaves urls that do not carry the mirror prefix alone", () => {
    const css = `@font-face { src: url("https://cdn.example.com/inter.woff2") format("woff2"); }`;

    expect(rewriteFontUrls(css, "/fonts/")).toBe(css);
  });
});
