import { load, type CheerioAPI } from "cheerio";

export function loadHtml(html: string): CheerioAPI {
  return load(html);
}

export function extractAnchorHrefs(html: string): string[] {
  const $ = loadHtml(html);

  return $("a")
    .toArray()
    .map((el) => $(el).attr("href"))
    .filter((href) => href !== undefined);
}
