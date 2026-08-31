import { rewriteFontUrls } from "#lib/snapshot-store/fonts.ts";
import { facesFromCss, fontFaceRule, providerStylesheetUrls } from "#snapshot/utils/run-font-pass.ts";

describe("providerStylesheetUrls", () => {
  it("collects provider stylesheet links and a WebFont.load google url", () => {
    const html = `
      <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Inter:400,700">
      <link rel="stylesheet" href="/site.css">
      <script>WebFont.load({ google: { families: ["Montserrat:400,700"] } });</script>`;
    const urls = providerStylesheetUrls(html, "https://example.com/");
    expect(urls).toContain("https://fonts.googleapis.com/css?family=Inter:400,700");
    expect(urls.some((url) => url.includes("Montserrat"))).toBe(true);
    expect(urls.some((url) => url.includes("site.css"))).toBe(false);
  });
});

describe("facesFromCss", () => {
  it("resolves relative binary urls against the stylesheet url", () => {
    const css = `@font-face { font-family: "Acme"; font-weight: 700; src: url(../fonts/acme-700.woff2) format("woff2"); }`;
    const faces = facesFromCss(css, "https://example.com/styles/site.css");
    expect(faces).toEqual([{ family: "Acme", weight: "700", binaryUrl: "https://example.com/fonts/acme-700.woff2" }]);
  });

  it("drops faces without a src url", () => {
    expect(facesFromCss(`@font-face { font-family: "NoSrc"; }`, "https://example.com/a.css")).toEqual([]);
  });
});

describe("fontFaceRule", () => {
  it("emits a rule with the mirrored url", () => {
    const rule = fontFaceRule(
      { family: "Inter", weight: "400", style: "normal", binaryUrl: "https://x/inter.woff2" },
      "../assets/fonts/inter.woff2",
    );
    expect(rule).toContain('font-family: "Inter";');
    expect(rule).toContain('src: url("../assets/fonts/inter.woff2") format("woff2");');
    expect(rule).toContain("font-weight: 400;");
  });

  it("emits a url the app-side rewrite can retarget", () => {
    const rule = fontFaceRule(
      { family: "Inter", weight: "400", style: "normal", binaryUrl: "https://x/inter.woff2" },
      "../assets/fonts/inter.woff2",
    );

    expect(rewriteFontUrls(rule, "/fonts/")).toContain('url("/fonts/inter.woff2")');
  });
});
