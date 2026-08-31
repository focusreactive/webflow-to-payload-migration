import type { PagesData, PageSource } from "#ir/pages.ts";

export interface ClassifiedPage {
  route: string;
  kind: "static" | "item";
  collectionKey?: string;
  slug?: string;
  localeId?: string;
  source: PageSource;
}

type PageRecord = PagesData["pages"][number];
type CollectionRecord = PagesData["collections"][number];
type OptionalPageKey = "collectionKey" | "slug" | "localeId";

const SOURCE_RANK: Record<PageSource, number> = {
  sitemap: 0,
  crawl: 1,
  searchindex: 2,
};

function firstDefined(records: readonly ClassifiedPage[], key: OptionalPageKey): string | undefined {
  for (const record of records) {
    const value = record[key];
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function directoryOf(route: string): string {
  const separatorIndex = route.lastIndexOf("/");

  return separatorIndex <= 0 ? "" : route.slice(0, separatorIndex);
}

function mergeRoute(route: string, records: ClassifiedPage[]): PageRecord {
  const [first] = records;
  if (!first) {
    throw new Error(`unreachable: empty group for route "${route}"`);
  }

  const sources = Array.from(new Set(records.map((record) => record.source))).sort(
    (a, b) => SOURCE_RANK[a] - SOURCE_RANK[b],
  );
  const collectionKey = firstDefined(records, "collectionKey");
  const slug = firstDefined(records, "slug");
  const localeId = firstDefined(records, "localeId");

  return {
    route,
    kind: first.kind,
    ...(collectionKey !== undefined ? { collectionKey } : {}),
    ...(slug !== undefined ? { slug } : {}),
    ...(localeId !== undefined ? { localeId } : {}),
    sources,
  };
}

function buildCollection(key: string, items: PageRecord[]): CollectionRecord {
  const [firstItem] = items;
  if (!firstItem) {
    throw new Error(`unreachable: empty collection group for key "${key}"`);
  }

  return {
    key,
    routePattern: `${directoryOf(firstItem.route)}/:slug`,
    itemCount: items.length,
  };
}

export function buildPagesData(classified: ClassifiedPage[]): PagesData {
  const byRoute = new Map<string, ClassifiedPage[]>();
  for (const page of classified) {
    const group = byRoute.get(page.route);
    if (group) {
      group.push(page);
    } else {
      byRoute.set(page.route, [page]);
    }
  }

  const pages = Array.from(byRoute.entries())
    .map(([route, records]) => mergeRoute(route, records))
    .sort((a, b) => a.route.localeCompare(b.route));

  const itemsByCollection = new Map<string, PageRecord[]>();
  for (const page of pages) {
    if (page.kind !== "item" || page.collectionKey === undefined) {
      continue;
    }

    const group = itemsByCollection.get(page.collectionKey);
    if (group) {
      group.push(page);
    } else {
      itemsByCollection.set(page.collectionKey, [page]);
    }
  }

  const collections = Array.from(itemsByCollection.entries())
    .map(([key, items]) => buildCollection(key, items))
    .sort((a, b) => a.key.localeCompare(b.key));

  return { pages, collections };
}
