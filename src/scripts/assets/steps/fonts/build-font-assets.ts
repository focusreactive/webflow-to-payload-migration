import { assetIdFromCanonicalUrl, type FontAssetRecord, type FontAssetsData } from "#ir/assets.ts";
import type { SnapshotStore } from "#lib/snapshot-store/types.ts";

import { parseFontFaces } from "../../parse-font-faces.ts";
import { parseWebFontLoad } from "../../parse-web-font-load.ts";

import { buildFontFamilies } from "./build-font-families.ts";

export async function buildFontAssets(store: SnapshotStore): Promise<FontAssetsData> {
  const entries = store.entries();
  const htmlEntries = entries.filter((entry) => entry.kind === "page" || entry.kind === "probe");
  const styleEntries = entries.filter((entry) => entry.kind === "style");

  const faces = [];
  const googleFamilies = [];
  for (const entry of htmlEntries) {
    const html = (await store.readBody(entry)).toString("utf8");
    faces.push(...parseFontFaces(html));
    googleFamilies.push(...parseWebFontLoad(html));
  }
  for (const entry of styleEntries) {
    const css = (await store.readBody(entry)).toString("utf8");
    faces.push(...parseFontFaces(css));
  }

  const assets = buildFontFamilies({ faces, googleFamilies }).map(({ family, face, srcUrl }): FontAssetRecord => {
    const canonicalUrl = srcUrl ?? `font:${family}`;
    return {
      assetId: assetIdFromCanonicalUrl(canonicalUrl),
      kind: "font",
      canonicalUrl,
      status: "downloaded",
      sources: [srcUrl !== undefined ? "font-face" : "webfont-load"],
      ...(srcUrl !== undefined && { fileName: face.family }),
      font: face,
    };
  });

  return { assets: assets.sort((a, b) => a.assetId.localeCompare(b.assetId)) };
}
