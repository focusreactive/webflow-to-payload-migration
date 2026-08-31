import type { ClassifiedPage } from "#adapters/shared/pages.ts";
import type { PlatformHints } from "#ir/detect.ts";
import type { Logger } from "#lib/logger.ts";
import type { SnapshotStore } from "#lib/snapshot-store/types.ts";

export interface InventoryCrawlContext {
  origin: string;
  sourceUrl: string;
  sitemapUrls: string[];
  platformHints: PlatformHints;
  store: SnapshotStore;
  maxPages: number;
  logger: Logger;
}

export interface InventoryCrawlResult {
  pages: ClassifiedPage[];
  warnings: string[];
}

export type InventoryCrawler = (context: InventoryCrawlContext) => Promise<InventoryCrawlResult>;
