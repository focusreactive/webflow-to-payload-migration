import {
  assetIdFromCanonicalUrl,
  fontAssetsDataSchema,
  mediaAssetsDataSchema,
  type FontAssetsData,
  type MediaAssetsData,
} from "#ir/assets.ts";

const imageUrl = "https://cdn.prod.website-files.com/site/62005ea0_photo.jpg";
const fontUrl = "https://cdn.prod.website-files.com/site/DMMono-Light.woff2";

const validMedia: MediaAssetsData = {
  assets: [
    {
      assetId: assetIdFromCanonicalUrl(imageUrl),
      kind: "image",
      canonicalUrl: imageUrl,
      status: "downloaded",
      sources: ["img-src"],
      fileName: "photo.jpg",
      storePath: "assets/photo.jpg",
      contentSha256: "a".repeat(64),
      contentType: "image/jpeg",
      size: 1234,
      alt: "A photo",
    },
  ],
};

const validFonts: FontAssetsData = {
  assets: [
    {
      assetId: assetIdFromCanonicalUrl(fontUrl),
      kind: "font",
      canonicalUrl: fontUrl,
      status: "downloaded",
      sources: ["font-face"],
      fileName: "dmmono-light.woff2",
      storePath: "assets/dmmono-light.woff2",
      font: {
        family: "DM Mono",
        weights: ["300"],
        classification: "custom",
        downloaded: true,
        licenseRisk: true,
      },
    },
  ],
};

describe("mediaAssetsDataSchema", () => {
  it("parses a valid media record", () => {
    expect(mediaAssetsDataSchema.parse(validMedia)).toEqual(validMedia);
  });

  it("round-trips through JSON", () => {
    const roundTripped = mediaAssetsDataSchema.parse(JSON.parse(JSON.stringify(validMedia)));

    expect(roundTripped).toEqual(validMedia);
  });

  it("rejects an unknown key on a record (strict)", () => {
    const withExtra = { assets: [{ ...validMedia.assets[0], surprise: true }] };

    expect(() => mediaAssetsDataSchema.parse(withExtra)).toThrow();
  });

  it("rejects a record with an empty sources array", () => {
    const emptySources = { assets: [{ ...validMedia.assets[0], sources: [] }] };

    expect(() => mediaAssetsDataSchema.parse(emptySources)).toThrow();
  });

  it("rejects a font source", () => {
    const fromFontFace = { assets: [{ ...validMedia.assets[0], sources: ["font-face"] }] };

    expect(() => mediaAssetsDataSchema.parse(fromFontFace)).toThrow();
  });

  it("rejects a font face on a media record", () => {
    const withFace = { assets: [{ ...validMedia.assets[0], font: validFonts.assets[0]?.font }] };

    expect(() => mediaAssetsDataSchema.parse(withFace)).toThrow();
  });

  it("rejects a font record", () => {
    expect(() => mediaAssetsDataSchema.parse(validFonts)).toThrow();
  });
});

describe("fontAssetsDataSchema", () => {
  it("parses a valid font record", () => {
    expect(fontAssetsDataSchema.parse(validFonts)).toEqual(validFonts);
  });

  it("round-trips through JSON", () => {
    const roundTripped = fontAssetsDataSchema.parse(JSON.parse(JSON.stringify(validFonts)));

    expect(roundTripped).toEqual(validFonts);
  });

  it("rejects a media source", () => {
    const fromCssUrl = { assets: [{ ...validFonts.assets[0], sources: ["css-url"] }] };

    expect(() => fontAssetsDataSchema.parse(fromCssUrl)).toThrow();
  });

  it("rejects a record without a font face", () => {
    const withoutFace: Record<string, unknown> = { ...validFonts.assets[0] };
    delete withoutFace["font"];

    expect(() => fontAssetsDataSchema.parse({ assets: [withoutFace] })).toThrow();
  });

  it("rejects a media record", () => {
    expect(() => fontAssetsDataSchema.parse(validMedia)).toThrow();
  });
});

describe("assetIdFromCanonicalUrl", () => {
  it("is deterministic for the same URL", () => {
    expect(assetIdFromCanonicalUrl(imageUrl)).toBe(assetIdFromCanonicalUrl(imageUrl));
  });

  it("produces different ids for different URLs", () => {
    expect(assetIdFromCanonicalUrl(imageUrl)).not.toBe(assetIdFromCanonicalUrl(fontUrl));
  });

  it("produces a stable 16-character hex id", () => {
    expect(assetIdFromCanonicalUrl(imageUrl)).toMatch(/^[0-9a-f]{16}$/);
  });
});
