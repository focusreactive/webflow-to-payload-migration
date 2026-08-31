import { extractCssUrls } from "./extract-css-urls.ts";

export function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, "").trim();
}

export function parseDeclarations(block: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const declaration of block.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const prop = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    if (prop !== "" && value !== "") map.set(prop, value);
  }
  return map;
}

export function firstFontUrl(srcDeclaration: string): string | undefined {
  const urls = extractCssUrls(srcDeclaration);

  return urls.find((url) => url.toLowerCase().includes(".woff2")) ?? urls[0];
}
