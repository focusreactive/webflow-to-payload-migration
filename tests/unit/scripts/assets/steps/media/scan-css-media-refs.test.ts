import { scanCssMediaRefs } from "#assets/steps/media/scan-css-media-refs.ts";

describe("scanCssMediaRefs", () => {
  it("extracts url() references, resolves relatives, and skips data URIs", () => {
    const css = `
      @font-face { src: url("/fonts/x.woff2") format("woff2"); }
      .a { background: url(../img/y.png); }
      .b { background: url(data:image/png;base64,AAAA); }
    `;
    const refs = scanCssMediaRefs(css, "https://site.example/css/main.css");

    expect(refs).toContainEqual({
      rawUrl: "https://site.example/fonts/x.woff2",
      source: "css-url",
      hint: "image",
    });
    expect(refs).toContainEqual({
      rawUrl: "https://site.example/img/y.png",
      source: "css-url",
      hint: "image",
    });
    expect(refs.some((r) => r.rawUrl.startsWith("data:"))).toBe(false);
  });
});
