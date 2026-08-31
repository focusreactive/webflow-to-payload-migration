import { FONT_FACE_BLOCK_PATTERN } from "./constants/fonts.ts";
import type { FontFaceSrc } from "./types.ts";
import { firstFontUrl, parseDeclarations, unquote } from "./utils/parse-font-faces.ts";

export function parseFontFaces(css: string): FontFaceSrc[] {
  const faces: FontFaceSrc[] = [];
  for (const match of css.matchAll(FONT_FACE_BLOCK_PATTERN)) {
    const declarations = parseDeclarations(match[1] ?? "");
    const family = declarations.get("font-family");
    if (family === undefined) continue;

    const weight = declarations.get("font-weight");
    const rawStyle = declarations.get("font-style");
    const style = rawStyle === "italic" || rawStyle === "normal" ? rawStyle : undefined;
    const unicodeRange = declarations.get("unicode-range");
    const srcDeclaration = declarations.get("src");
    const srcUrl = srcDeclaration !== undefined ? firstFontUrl(srcDeclaration) : undefined;

    faces.push({
      family: unquote(family),
      ...(weight !== undefined && { weight }),
      ...(style !== undefined && { style }),
      ...(unicodeRange !== undefined && { unicodeRange }),
      ...(srcUrl !== undefined && { srcUrl }),
    });
  }
  return faces;
}
