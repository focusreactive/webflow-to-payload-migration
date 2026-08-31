export interface RobotsInfo {
  crawlDelayMs?: number;
  sitemapUrls: string[];
}

const SECONDS_TO_MS = 1000;

export function parseRobots(content: string): RobotsInfo {
  const sitemapUrls: string[] = [];
  let crawlDelayMs: number | undefined;

  for (const rawLine of content.split(/\r\n|\r|\n/)) {
    const line = stripInlineComment(rawLine).trim();
    if (!line) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const field = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();
    if (!value) continue;

    if (field === "sitemap") {
      sitemapUrls.push(value);
    } else if (field === "crawl-delay") {
      const delayMs = parseCrawlDelayMs(value);
      if (delayMs !== undefined) {
        crawlDelayMs = crawlDelayMs === undefined ? delayMs : Math.max(crawlDelayMs, delayMs);
      }
    }
  }

  return crawlDelayMs === undefined ? { sitemapUrls } : { crawlDelayMs, sitemapUrls };
}

function parseCrawlDelayMs(value: string): number | undefined {
  const seconds = Number(value);

  return Number.isFinite(seconds) && seconds >= 0 ? seconds * SECONDS_TO_MS : undefined;
}

function stripInlineComment(line: string): string {
  const hashIndex = line.indexOf("#");

  return hashIndex === -1 ? line : line.slice(0, hashIndex);
}
