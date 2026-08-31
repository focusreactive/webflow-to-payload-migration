import type { MediaAssetKind, MediaAssetSource } from "#ir/assets.ts";
import { loadHtml } from "#lib/html.ts";

import { SOCIAL_IMAGE_KEYS, VIDEO_EXTENSIONS } from "../../constants/scan.ts";
import type { ScannedMediaRef } from "../../types.ts";
import { extractCssUrls } from "../../utils/extract-css-urls.ts";
import { resolveUrl } from "./utils/resolve-url.ts";
import { lightboxJsonSchema, srcsetCandidates } from "./utils/scan-html-media-refs.ts";

export function scanHtmlMediaRefs(html: string, baseUrl: string): ScannedMediaRef[] {
  const $ = loadHtml(html);
  const refs: ScannedMediaRef[] = [];

  const push = (rawUrl: string | undefined, source: MediaAssetSource, hint: MediaAssetKind, alt?: string): void => {
    if (rawUrl === undefined) return;
    const resolved = resolveUrl(rawUrl, baseUrl);
    if (resolved === undefined || resolved.startsWith("data:")) return;
    refs.push({ rawUrl: resolved, source, hint, ...(alt !== undefined && { alt }) });
  };

  $("img").each((_, el) => {
    const img = $(el);
    const alt = img.attr("alt");
    push(img.attr("src"), "img-src", "image", alt);
    const srcset = img.attr("srcset");
    if (srcset !== undefined) {
      for (const candidate of srcsetCandidates(srcset)) {
        push(candidate, "img-srcset", "image", alt);
      }
    }
  });

  $("[style]").each((_, el) => {
    const style = $(el).attr("style");
    if (style === undefined || !style.includes("background")) return;
    for (const url of extractCssUrls(style)) {
      push(url, "background-image", "image");
    }
  });

  $("script.w-json").each((_, el) => {
    const raw = $(el).text().trim();
    if (raw === "") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const result = lightboxJsonSchema.safeParse(parsed);
    if (!result.success) return;
    for (const item of result.data.items ?? []) {
      push(item.url, "lightbox-json", "image");
    }
  });

  $("[data-video-urls]").each((_, el) => {
    const csv = $(el).attr("data-video-urls");
    if (csv === undefined) return;
    for (const url of csv.split(",").map((u) => u.trim())) {
      if (VIDEO_EXTENSIONS.some((ext) => url.toLowerCase().includes(ext))) {
        push(url, "video-urls", "video");
      }
    }
  });

  $("[data-poster-url]").each((_, el) => {
    push($(el).attr("data-poster-url"), "poster-url", "image");
  });

  $("meta").each((_, el) => {
    const meta = $(el);
    const key = meta.attr("property") ?? meta.attr("name");
    if (key !== undefined && SOCIAL_IMAGE_KEYS.has(key)) {
      push(meta.attr("content"), "og-image", "image");
    }
  });

  return refs;
}
