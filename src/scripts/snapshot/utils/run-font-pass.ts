import { loadHtml } from "#lib/html.ts";
import { parseFontFaces } from "#assets/parse-font-faces.ts";
import { parseWebFontLoad } from "#assets/parse-web-font-load.ts";

import { FONT_FORMAT_BY_EXTENSION, FONT_PROVIDER_HOSTS, GOOGLE_FONTS_CSS_ORIGIN } from "../constants/fonts.ts";
import type { CollectedFontFace } from "../types.ts";

export function providerStylesheetUrls(html: string, baseUrl: string): string[] {
  const $ = loadHtml(html);
  const urls = new Set<string>();
  $("link[rel='stylesheet']").each((_, el) => {
    const href = $(el).attr("href");
    if (href === undefined) return;
    try {
      const resolved = new URL(href, baseUrl);
      if (FONT_PROVIDER_HOSTS.has(resolved.hostname)) urls.add(resolved.href);
    } catch {
      return;
    }
  });
  const families = parseWebFontLoad(html);
  if (families.length > 0) {
    urls.add(`${GOOGLE_FONTS_CSS_ORIGIN}?family=${families.map(encodeURIComponent).join("|")}&display=swap`);
  }
  return [...urls];
}

export function facesFromCss(css: string, cssUrl: string): CollectedFontFace[] {
  return parseFontFaces(css).flatMap((face) => {
    if (face.srcUrl === undefined) return [];
    let binaryUrl: string;
    try {
      binaryUrl = new URL(face.srcUrl, cssUrl).href;
    } catch {
      return [];
    }
    return [
      {
        family: face.family,
        ...(face.weight !== undefined && { weight: face.weight }),
        ...(face.style !== undefined && { style: face.style }),
        ...(face.unicodeRange !== undefined && { unicodeRange: face.unicodeRange }),
        binaryUrl,
      },
    ];
  });
}

export function dedupeFaces(faces: CollectedFontFace[]): CollectedFontFace[] {
  const byKey = new Map<string, CollectedFontFace>();
  for (const face of faces) {
    const key = [face.family, face.weight ?? "", face.style ?? "", face.unicodeRange ?? "", face.binaryUrl].join("|");
    if (!byKey.has(key)) byKey.set(key, face);
  }
  return [...byKey.values()];
}

export function fontFaceRule(face: CollectedFontFace, url: string): string {
  const ext = url.split(".").at(-1)?.toLowerCase() ?? "";
  const lines = [
    "@font-face {",
    `  font-family: "${face.family}";`,
    `  src: url("${url}") format("${FONT_FORMAT_BY_EXTENSION[ext] ?? "woff2"}");`,
  ];
  if (face.weight !== undefined) lines.push(`  font-weight: ${face.weight};`);
  if (face.style !== undefined) lines.push(`  font-style: ${face.style};`);
  if (face.unicodeRange !== undefined) lines.push(`  unicode-range: ${face.unicodeRange};`);
  lines.push("  font-display: swap;", "}");
  return lines.join("\n");
}

export function binaryFileName(url: string): string {
  const path = new URL(url).pathname;
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name === "" ? "font" : name;
}
