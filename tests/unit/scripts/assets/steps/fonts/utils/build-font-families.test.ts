import { classifyFontSource, fontDownloadPolicy } from "#assets/steps/fonts/utils/build-font-families.ts";

describe("classifyFontSource", () => {
  it("classifies a Google Fonts host", () => {
    expect(classifyFontSource("https://fonts.gstatic.com/s/inter/x.woff2")).toBe("google");
  });

  it("classifies a Fontshare host", () => {
    expect(classifyFontSource("https://cdn.fontshare.com/x.woff2")).toBe("fontshare");
  });

  it("classifies an Adobe Typekit host", () => {
    expect(classifyFontSource("https://use.typekit.net/x.css")).toBe("adobe");
  });

  it("classifies a site CDN host as custom", () => {
    expect(classifyFontSource("https://cdn.prod.website-files.com/site/DMMono-Light.woff2")).toBe("custom");
  });
});

describe("fontDownloadPolicy", () => {
  it("maps each classification to its download and license policy", () => {
    expect(fontDownloadPolicy("google")).toEqual({
      downloaded: false,
      licenseRisk: false,
    });
    expect(fontDownloadPolicy("fontshare")).toEqual({
      downloaded: true,
      licenseRisk: false,
    });
    expect(fontDownloadPolicy("custom")).toEqual({
      downloaded: true,
      licenseRisk: true,
    });
    expect(fontDownloadPolicy("adobe")).toEqual({
      downloaded: false,
      licenseRisk: true,
    });
  });
});
