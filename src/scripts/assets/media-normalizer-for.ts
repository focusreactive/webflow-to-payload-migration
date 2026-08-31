import { webflowMediaNormalizer } from "#adapters/webflow/media-normalize.ts";

import type { MediaNormalizer } from "./types.ts";

export function mediaNormalizerFor(): MediaNormalizer {
  return webflowMediaNormalizer;
}
