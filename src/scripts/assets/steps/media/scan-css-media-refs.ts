import type { ScannedMediaRef } from "../../types.ts";
import { extractCssUrls } from "../../utils/extract-css-urls.ts";
import { resolveUrl } from "./utils/resolve-url.ts";

export function scanCssMediaRefs(css: string, baseUrl: string): ScannedMediaRef[] {
  const refs: ScannedMediaRef[] = [];
  for (const url of extractCssUrls(css)) {
    const resolved = resolveUrl(url, baseUrl);
    if (resolved !== undefined) {
      refs.push({ rawUrl: resolved, source: "css-url", hint: "image" });
    }
  }
  return refs;
}
