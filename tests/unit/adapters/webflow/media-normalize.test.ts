import {
  canonicalizeWebflowAssetUrl,
  isWebflowVariantUrl,
  webflowAssetFileName,
  webflowAssetPlatformId,
  webflowMediaNormalizer,
} from "#adapters/webflow/media-normalize.ts";

const SITE = "66ba00000000000000000001";
const ASSET = "62005ea000000000000000ab";

describe("canonicalizeWebflowAssetUrl", () => {
  it("rewrites host aliases to the canonical Webflow CDN host", () => {
    const path = `/${SITE}/${ASSET}_photo.jpg`;
    const canonical = `https://cdn.prod.website-files.com${path}`;

    expect(canonicalizeWebflowAssetUrl(`https://assets.website-files.com${path}`)).toBe(canonical);
    expect(canonicalizeWebflowAssetUrl(`https://assets-global.website-files.com${path}`)).toBe(canonical);
    expect(canonicalizeWebflowAssetUrl(`https://uploads-ssl.webflow.com${path}`)).toBe(canonical);
  });

  it("drops the query string on Webflow CDN URLs", () => {
    expect(canonicalizeWebflowAssetUrl(`https://cdn.prod.website-files.com/${SITE}/${ASSET}_photo.jpg?v=2`)).toBe(
      `https://cdn.prod.website-files.com/${SITE}/${ASSET}_photo.jpg`,
    );
  });

  it("decodes %2F encoded slashes between site id and file", () => {
    expect(canonicalizeWebflowAssetUrl(`https://cdn.prod.website-files.com/${SITE}%2F${ASSET}_poster.jpg`)).toBe(
      `https://cdn.prod.website-files.com/${SITE}/${ASSET}_poster.jpg`,
    );
  });

  it("does not strip responsive variant suffixes (they stay canonical)", () => {
    const variant = `https://cdn.prod.website-files.com/${SITE}/${ASSET}_project-01-1-p-500.jpg`;

    expect(canonicalizeWebflowAssetUrl(variant)).toBe(variant);
  });
});

describe("isWebflowVariantUrl", () => {
  it("flags a known responsive width suffix", () => {
    expect(isWebflowVariantUrl(`https://x/${ASSET}_project-01-1-p-500.jpg`)).toBe(true);
  });

  it("flags a variant even when the extension changed", () => {
    expect(isWebflowVariantUrl(`https://x/${ASSET}_project-01-1-p-500.jpeg`)).toBe(true);
  });

  it("does not flag the original (no width suffix)", () => {
    expect(isWebflowVariantUrl(`https://x/${ASSET}_project-01-1.jpg`)).toBe(false);
  });

  it("does not flag an unknown width", () => {
    expect(isWebflowVariantUrl(`https://x/${ASSET}_project-01-1-p-999.jpg`)).toBe(false);
  });
});

describe("webflowAssetFileName", () => {
  it("returns the name after the platform-id prefix", () => {
    expect(webflowAssetFileName(`https://cdn.prod.website-files.com/${SITE}/${ASSET}_sama-hosseini-unsplash.jpg`)).toBe(
      "sama-hosseini-unsplash.jpg",
    );
  });

  it("sanitizes spaces and encoded characters", () => {
    expect(webflowAssetFileName(`https://cdn.prod.website-files.com/${SITE}/${ASSET}_My%20Photo.jpg`)).toBe(
      "my-photo.jpg",
    );
  });

  it("keeps svg logos", () => {
    expect(webflowAssetFileName(`https://cdn.prod.website-files.com/${SITE}/${ASSET}_white-logo.svg`)).toBe(
      "white-logo.svg",
    );
  });
});

describe("webflowAssetPlatformId", () => {
  it("extracts the 24-hex platform id prefix", () => {
    expect(webflowAssetPlatformId(`https://cdn.prod.website-files.com/${SITE}/${ASSET}_photo.jpg`)).toBe(ASSET);
  });

  it("returns undefined when the prefix is not a valid platform id", () => {
    expect(webflowAssetPlatformId("https://example.com/images/plain-photo.jpg")).toBeUndefined();
  });
});

describe("webflowMediaNormalizer", () => {
  it("canonicalizes and exposes platform id and original name", () => {
    const asset = webflowMediaNormalizer.canonicalize(
      `https://assets.website-files.com/${SITE}/${ASSET}_sama-hosseini-unsplash.jpg?x=1`,
    );

    expect(asset).toEqual({
      canonicalUrl: `https://cdn.prod.website-files.com/${SITE}/${ASSET}_sama-hosseini-unsplash.jpg`,
      platformId: ASSET,
      originalName: "sama-hosseini-unsplash.jpg",
    });
  });

  it("delegates isVariant and fileName to the pure helpers", () => {
    expect(webflowMediaNormalizer.isVariant(`https://x/${ASSET}_project-01-1-p-800.jpg`)).toBe(true);
    expect(webflowMediaNormalizer.fileName(`https://cdn.prod.website-files.com/${SITE}/${ASSET}_white-logo.svg`)).toBe(
      "white-logo.svg",
    );
  });
});
