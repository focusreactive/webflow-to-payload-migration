import type { MediaAssetRecord, MediaAssetsData } from "#ir/assets.ts";

import type { BuildMediaAssetsOpts, ScannedMediaRef } from "../../types.ts";

import { scanCssMediaRefs } from "./scan-css-media-refs.ts";
import { scanHtmlMediaRefs } from "./scan-html-media-refs.ts";
import { applyContentDedup, buildMediaAssetRecord, groupMediaRefs } from "./utils/build-media-assets.ts";

export async function buildMediaAssets(opts: BuildMediaAssetsOpts): Promise<MediaAssetsData> {
  const { store } = opts;
  const entries = store.entries();
  const htmlEntries = entries.filter((entry) => entry.kind === "page" || entry.kind === "probe");
  const styleEntries = entries.filter((entry) => entry.kind === "style");

  const mediaRefs: ScannedMediaRef[] = [];
  for (const entry of htmlEntries) {
    const html = (await store.readBody(entry)).toString("utf8");
    mediaRefs.push(...scanHtmlMediaRefs(html, entry.url));
  }
  for (const entry of styleEntries) {
    const css = (await store.readBody(entry)).toString("utf8");
    mediaRefs.push(...scanCssMediaRefs(css, entry.url));
  }

  const groups = groupMediaRefs(mediaRefs, opts.normalizer);
  const assets: MediaAssetRecord[] = [];
  for (const group of groups) {
    assets.push(await buildMediaAssetRecord(group, opts));
  }
  applyContentDedup(assets);

  return { assets: assets.sort((a, b) => a.assetId.localeCompare(b.assetId)) };
}
