import type { PagesData } from "#ir/pages.ts";

export function representativeRoutes(pages: PagesData): string[] {
  const seen = new Set<string>();
  const routes: string[] = [];
  for (const page of pages.pages) {
    if (page.kind === "item" && page.collectionKey !== undefined) {
      if (seen.has(page.collectionKey)) continue;
      seen.add(page.collectionKey);
    }
    routes.push(page.route);
  }
  return routes;
}

export function representativeStaticRoutes(pages: PagesData): string[] {
  return pages.pages.filter((page) => page.kind !== "item").map((page) => page.route);
}
