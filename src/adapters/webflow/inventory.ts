import type { InventoryCrawler } from "#adapters/shared/inventory.ts";
import { crawlWebflow, type SeedUrl } from "#adapters/webflow/crawl.ts";

// Webflow seeds the crawl from the source URL plus every sitemap URL, then
// follows in-origin links.
export const webflowInventoryCrawler: InventoryCrawler = async (context) => {
  const seedUrls: SeedUrl[] = [
    { url: context.sourceUrl, source: "crawl" },
    ...context.sitemapUrls.map((url): SeedUrl => ({ url, source: "sitemap" })),
  ];

  return crawlWebflow({
    origin: context.origin,
    seedUrls,
    store: context.store,
    maxPages: context.maxPages,
    logger: context.logger,
  });
};
