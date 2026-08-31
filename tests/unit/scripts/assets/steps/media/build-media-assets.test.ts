import { buildMediaAssets } from "#assets/steps/media/build-media-assets.ts";
import { webflowMediaNormalizer } from "#adapters/webflow/media-normalize.ts";
import type { MediaAssetsData } from "#ir/assets.ts";

import { A1, A2, cdn, makeFakeStore, nullLogger, SITE, type FakeStoreConfig } from "../../fixtures/assets.ts";

async function build(config: FakeStoreConfig): Promise<MediaAssetsData> {
  return buildMediaAssets({
    store: makeFakeStore(config),
    normalizer: webflowMediaNormalizer,
    logger: nullLogger,
  });
}

describe("buildMediaAssets", () => {
  it("merges the same asset referenced from two pages and picks the most frequent alt", async () => {
    const url = cdn(`/${SITE}/${A1}_photo.jpg`);
    const data = await build({
      pages: [
        { url: "https://site.example/", html: `<img src="${url}" alt="Home hero">` },
        {
          url: "https://site.example/about",
          html: `<img src="${url}" alt="Home hero"><div style="background-image:url('${url}')"></div>`,
        },
      ],
      assets: {
        [url]: { bytes: Buffer.from("photo-bytes"), contentType: "image/jpeg" },
      },
    });

    const photos = data.assets.filter((a) => a.canonicalUrl === url);
    expect(photos).toHaveLength(1);
    expect(photos[0]?.sources).toEqual(["background-image", "img-src"]);
    expect(photos[0]?.alt).toBe("Home hero");
    expect(photos[0]?.status).toBe("downloaded");
    expect(photos[0]?.storePath).toBeDefined();
  });

  it("keeps only the original and skips -p- responsive variants", async () => {
    const original = cdn(`/${SITE}/${A1}_project.jpg`);
    const html = `<img src="${original}" srcset="${cdn(`/${SITE}/${A1}_project-p-500.jpg`)} 500w, ${cdn(`/${SITE}/${A1}_project-p-800.jpg`)} 800w">`;
    const data = await build({
      pages: [{ url: "https://site.example/", html }],
      assets: { [original]: { bytes: Buffer.from("orig") } },
    });

    const images = data.assets.filter((a) => a.kind === "image");
    expect(images).toHaveLength(1);
    expect(images[0]?.canonicalUrl).toBe(original);
  });

  it("folds host aliases to one canonical asset", async () => {
    const canonical = cdn(`/${SITE}/${A1}_logo.svg`);
    const data = await build({
      pages: [
        {
          url: "https://site.example/",
          html: `<img src="https://assets.website-files.com/${SITE}/${A1}_logo.svg"><img src="${canonical}">`,
        },
      ],
      assets: { [canonical]: { bytes: Buffer.from("svg") } },
    });

    expect(data.assets.filter((a) => a.kind === "image")).toHaveLength(1);
  });

  it("marks the second asset with identical bytes as an alias of the first", async () => {
    const u1 = cdn(`/${SITE}/${A1}_one.jpg`);
    const u2 = cdn(`/${SITE}/${A2}_two.jpg`);
    const sameBytes = Buffer.from("identical");
    const data = await build({
      pages: [{ url: "https://site.example/", html: `<img src="${u1}"><img src="${u2}">` }],
      assets: {
        [u1]: { bytes: sameBytes },
        [u2]: { bytes: sameBytes },
      },
    });

    const aliased = data.assets.filter((a) => a.aliasOf !== undefined);
    expect(aliased).toHaveLength(1);
    const first = data.assets.find((a) => a.aliasOf === undefined && a.kind === "image");
    expect(aliased[0]?.aliasOf).toBe(first?.assetId);
  });

  it("records a failed download for a 404 asset without a store path", async () => {
    const url = cdn(`/${SITE}/${A1}_missing.jpg`);
    const data = await build({
      pages: [{ url: "https://site.example/", html: `<img src="${url}">` }],
      assets: { [url]: { bytes: Buffer.alloc(0), status: 404 } },
    });

    const record = data.assets.find((a) => a.canonicalUrl === url);
    expect(record?.status).toBe("failed");
    expect(record?.storePath).toBeUndefined();
    expect(record?.failureReason).toBeDefined();
  });

  it("produces a deterministic ordering regardless of traversal order", async () => {
    const u1 = cdn(`/${SITE}/${A1}_one.jpg`);
    const u2 = cdn(`/${SITE}/${A2}_two.jpg`);
    const assets = {
      [u1]: { bytes: Buffer.from("one") },
      [u2]: { bytes: Buffer.from("two") },
    };
    const forward = await build({
      pages: [{ url: "https://site.example/", html: `<img src="${u1}"><img src="${u2}">` }],
      assets,
    });
    const reverse = await build({
      pages: [{ url: "https://site.example/", html: `<img src="${u2}"><img src="${u1}">` }],
      assets,
    });

    expect(forward.assets.map((a) => a.assetId)).toEqual(reverse.assets.map((a) => a.assetId));
  });
});
