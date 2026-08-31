import { resolve } from "node:path";

import { buildAssetSrcIndex, resolveMediaRecord } from "#synth/steps/input-build/utils/media-input.ts";

const srcOf = (assetId: string): string | undefined =>
  assetId === "a1" ? "/@fs/snap/img.png"
  : assetId === "v1" ? "/@fs/snap/hero.mp4"
  : undefined;

describe("resolveMediaRecord", () => {
  it("maps {assetId, alt} to {src, alt} for image/file/video fields, recursing into arrays and groups", () => {
    const fields = [
      { name: "photo", type: { type: "image" as const } },
      {
        name: "gallery",
        type: { type: "array" as const, element: { type: "image" as const } },
      },
      {
        name: "card",
        type: {
          type: "group" as const,
          fields: [{ name: "icon", type: { type: "image" as const }, required: false }],
        },
      },
      { name: "clip", type: { type: "video" as const } },
      { name: "title", type: { type: "text" as const } },
    ];
    const record = {
      photo: { assetId: "a1", alt: "hero" },
      gallery: [{ assetId: "a1" }],
      card: { icon: { assetId: "missing" } },
      clip: { assetId: "v1" },
      title: "hi",
    };
    expect(resolveMediaRecord(fields, record, srcOf)).toEqual({
      photo: { src: "/@fs/snap/img.png", alt: "hero" },
      gallery: [{ src: "/@fs/snap/img.png" }],
      card: { icon: { src: "" } },
      clip: { src: "/@fs/snap/hero.mp4" },
      title: "hi",
    });
  });
});

describe("buildAssetSrcIndex", () => {
  it("maps asset ids to absolute /@fs snapshot urls", () => {
    const assets = {
      assets: [
        {
          assetId: "a1",
          kind: "image",
          canonicalUrl: "https://x/img.png",
          status: "downloaded",
          sources: ["img-src"],
          storePath: "assets/img.png",
        },
      ],
    };
    const index = buildAssetSrcIndex("/tmp/project", assets as never);
    expect(index.get("a1")).toBe(`/@fs${resolve("/tmp/project", ".migration/snapshot", "assets/img.png")}`);
  });
});
