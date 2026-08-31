import { CSS_URL_PATTERN } from "../constants/css.ts";

export function extractCssUrls(css: string): string[] {
  const urls: string[] = [];
  for (const match of css.matchAll(CSS_URL_PATTERN)) {
    const value = match[2]?.trim();
    if (value !== undefined && value !== "" && !value.startsWith("data:")) {
      urls.push(value);
    }
  }
  return urls;
}
