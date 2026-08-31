import { webflowInventoryCrawler } from "#adapters/webflow/inventory.ts";

import type { InventoryCrawler } from "#adapters/shared/inventory.ts";

export function inventoryCrawlerFor(): InventoryCrawler {
  return webflowInventoryCrawler;
}
