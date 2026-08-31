import { loadHtml } from "#lib/html.ts";

import { extractBalancedBrackets } from "./utils/parse-web-font-load.ts";

export function parseWebFontLoad(html: string): string[] {
  const $ = loadHtml(html);
  const families: string[] = [];

  $("script").each((_, el) => {
    const text = $(el).text();
    let searchFrom = text.indexOf("WebFont.load");
    while (searchFrom >= 0) {
      const config = extractBalancedBrackets(text, searchFrom, "{", "}");
      const googleIndex = config?.indexOf("google") ?? -1;
      if (config !== undefined && googleIndex >= 0) {
        const familiesArray = extractBalancedBrackets(config, googleIndex, "[", "]");
        if (familiesArray !== undefined) {
          for (const literal of familiesArray.matchAll(/(['"])(.*?)\1/g)) {
            const value = literal[2];
            if (value !== undefined && value !== "") families.push(value);
          }
        }
      }
      searchFrom = text.indexOf("WebFont.load", searchFrom + 1);
    }
  });

  return families;
}
