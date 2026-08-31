import { describe, expect, it } from "vitest";

import { webflowInventoryCrawler } from "#adapters/webflow/inventory.ts";
import { inventoryCrawlerFor } from "#inventory/inventory-crawler-for.ts";

describe("inventoryCrawlerFor", () => {
  it("returns the webflow crawler, the only crawler this tool has", () => {
    expect(inventoryCrawlerFor()).toBe(webflowInventoryCrawler);
  });
});
