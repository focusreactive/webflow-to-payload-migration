import type { ClassifiedPage } from "#adapters/shared/pages.ts";
import { extractAnchorHrefs } from "#lib/html.ts";
import type { Logger } from "#lib/logger.ts";
import { normalizeUrl, routeFromUrl } from "#lib/url.ts";
import type { SnapshotStore } from "#lib/snapshot-store/types.ts";
import { classifyWebflowPage } from "./classify.ts";
import { findPaginations, paginationUrls } from "./pagination.ts";

type ClassifiedFields = Omit<ClassifiedPage, "source">;

type CrawlSource = "sitemap" | "crawl";

export interface SeedUrl {
  url: string;
  source: CrawlSource;
}

export interface CrawlResult {
  pages: ClassifiedPage[];
  warnings: string[];
}

interface QueueItem {
  url: string;
  source: CrawlSource;
}

export async function crawlWebflow(opts: {
  origin: string;
  seedUrls: SeedUrl[];
  store: SnapshotStore;
  maxPages: number;
  logger: Logger;
}): Promise<CrawlResult> {
  const { origin, store, maxPages, logger } = opts;

  const warnings: string[] = [];
  const warn = (message: string): void => {
    warnings.push(message);
    logger.warn(message);
  };

  const sourcesByUrl = new Map<string, Set<CrawlSource>>();
  const visited = new Set<string>();
  const queued = new Set<string>();
  const queue: QueueItem[] = [];

  const enqueue = (rawUrl: string, source: CrawlSource): void => {
    const normalized = normalizeUrl(rawUrl);

    const sources = sourcesByUrl.get(normalized);
    if (sources) {
      sources.add(source);
    } else {
      sourcesByUrl.set(normalized, new Set([source]));
    }

    if (visited.has(normalized) || queued.has(normalized)) return;
    queued.add(normalized);
    queue.push({ url: normalized, source });
  };

  const nextItem = (): QueueItem | undefined => queue.shift();

  for (const seed of opts.seedUrls) {
    enqueue(seed.url, seed.source);
  }

  const classifiedByUrl = new Map<string, ClassifiedFields>();
  const collectionKeysByPageId = new Map<string, Set<string>>();
  let fetchedCount = 0;

  for (;;) {
    const item = nextItem();
    if (!item) break;

    if (fetchedCount >= maxPages) {
      warn(`maxPages reached (${maxPages})`);
      break;
    }

    queued.delete(item.url);
    visited.add(item.url);

    fetchedCount += 1;

    let entry;
    try {
      entry = await store.fetchInto(item.url, "page");
    } catch (error) {
      warn(`fetch error: ${item.url}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    if (entry.http.status >= 400) {
      warn(`fetch failed: ${item.url} (status ${entry.http.status})`);
      continue;
    }

    const body = await store.readBody(entry);
    const html = body.toString("utf8");
    const classified = classifyWebflowPage(html);

    if (!classified.isWebflow) {
      warn(`non-webflow page: ${item.url}`);
      continue;
    }

    const route = routeFromUrl(entry.http.finalUrl);

    classifiedByUrl.set(item.url, {
      route,
      kind: classified.kind,
      ...(classified.collectionKey !== undefined && {
        collectionKey: classified.collectionKey,
      }),
      ...(classified.slug !== undefined && { slug: classified.slug }),
      ...(classified.localeId !== undefined && {
        localeId: classified.localeId,
      }),
    });

    if (classified.kind === "item" && classified.pageId !== undefined && classified.collectionKey !== undefined) {
      const collectionKeys = collectionKeysByPageId.get(classified.pageId);
      if (collectionKeys) {
        collectionKeys.add(classified.collectionKey);
      } else {
        collectionKeysByPageId.set(classified.pageId, new Set([classified.collectionKey]));
      }
    }

    for (const href of extractAnchorHrefs(html)) {
      let resolvedUrl: string;
      try {
        resolvedUrl = new URL(href, entry.http.finalUrl).toString();
      } catch {
        continue;
      }

      const normalized = normalizeUrl(resolvedUrl);
      if (new URL(normalized).origin !== origin) continue;

      enqueue(normalized, "crawl");
    }

    for (const pagination of findPaginations(html)) {
      for (const pageUrl of paginationUrls(entry.http.finalUrl, pagination)) {
        enqueue(pageUrl, "crawl");
      }
    }
  }

  for (const [pageId, collectionKeys] of collectionKeysByPageId) {
    if (collectionKeys.size > 1) {
      warn(`pageId ${pageId} maps to multiple collections: ${Array.from(collectionKeys).sort().join(", ")}`);
    }
  }

  const pages: ClassifiedPage[] = [];
  for (const [url, fields] of classifiedByUrl) {
    const sources = sourcesByUrl.get(url);
    if (!sources) {
      throw new Error(`unreachable: no sources recorded for classified url "${url}"`);
    }

    for (const source of sources) {
      pages.push({ ...fields, source });
    }
  }

  return { pages, warnings };
}
