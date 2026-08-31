import { posix } from "node:path";

import { ASSETS_MIRROR_DIR } from "./paths.ts";

export const FONT_ASSETS_DIR = posix.join(ASSETS_MIRROR_DIR, "fonts");
export const FONTS_CSS_RELATIVE_PATH = posix.join("styles", "fonts.css");

export function rewriteFontUrls(fontsCss: string, toPrefix: string): string {
  return fontsCss.replaceAll(`url("../${FONT_ASSETS_DIR}/`, `url("${toPrefix}`);
}
