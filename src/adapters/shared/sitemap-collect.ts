import type { Logger } from "#lib/logger.ts";
import { parseSitemap } from "#lib/sitemap.ts";
import type { SnapshotStore } from "#lib/snapshot-store/types.ts";

async function collectChildUrlsetLocs(opts: {
  childLoc: string;
  store: SnapshotStore;
  logger: Logger;
}): Promise<string[]> {
  const { childLoc, store, logger } = opts;

  try {
    const entry = await store.fetchInto(childLoc, "data");
    const body = await store.readBody(entry);
    const parsed = parseSitemap(body.toString("utf8"));

    if (parsed.kind !== "urlset") {
      logger.debug("sitemap-collect: child is not a urlset, skipping", {
        childLoc,
        kind: parsed.kind,
      });
      return [];
    }

    return parsed.entries.map((sitemapEntry) => sitemapEntry.loc);
  } catch (error) {
    logger.warn("sitemap-collect: failed to fetch child sitemap, skipping", {
      childLoc,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function collectSitemapUrls(opts: {
  rootSitemapXml: string | undefined;
  store: SnapshotStore;
  logger: Logger;
}): Promise<string[]> {
  const { rootSitemapXml, store, logger } = opts;

  if (rootSitemapXml === undefined) return [];

  const root = parseSitemap(rootSitemapXml);

  let locs: string[];
  if (root.kind === "urlset") {
    locs = root.entries.map((entry) => entry.loc);
  } else if (root.kind === "sitemapindex") {
    const childLocLists = await Promise.all(
      root.entries.map((entry) => collectChildUrlsetLocs({ childLoc: entry.loc, store, logger })),
    );
    locs = childLocLists.flat();
  } else {
    locs = [];
  }

  return Array.from(new Set(locs));
}
