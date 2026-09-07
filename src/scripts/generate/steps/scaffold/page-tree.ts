import { segmentsOf, titleFromSlug } from "./utils/page-tree.ts";

export interface PageNode {
  path: string;
  slug: string;
  parentPath: string | null;
  depth: number;
  route: string | null;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

export function buildPageTree(routes: readonly string[]): PageNode[] {
  const byPath = new Map<string, PageNode>();

  for (const route of [...routes].sort()) {
    const segments = segmentsOf(route);

    for (const [index, slug] of segments.entries()) {
      const path = segments.slice(0, index + 1).join("/");
      const isLeaf = index === segments.length - 1;
      const existing = byPath.get(path);

      if (existing === undefined) {
        byPath.set(path, {
          path,
          slug,
          parentPath: index === 0 ? null : segments.slice(0, index).join("/"),
          depth: index,
          route: isLeaf ? route : null,
          title: titleFromSlug(slug),
          metaTitle: null,
          metaDescription: null,
        });
        continue;
      }
      if (isLeaf && existing.route === null) existing.route = route;
    }
  }

  return [...byPath.values()].sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path));
}
