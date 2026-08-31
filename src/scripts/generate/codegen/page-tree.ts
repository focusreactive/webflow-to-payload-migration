// The `page` collection is nested (parent + breadcrumbs), so a captured route
// "/solutions/devops" needs a "solutions" document even when that route was never captured.
// The tree is computed here, in the tool, and shipped to the deliverable as an artifact so
// the seed stays a dumb writer and this logic is unit-tested once.
const HOME_PATH = "home";

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

// `page.slug` and `page.title` are both required in the base collection, and Payload enforces
// required fields on publish — an empty one would abort the whole seed. Dropping empty segments
// (so "/a//b" cannot yield a "" slug) and falling back to the raw slug (so "/--" cannot yield a
// "" title) makes "every node has a non-empty slug and title" an invariant of the artifact
// itself, which is the contract the seed writes blindly.
function segmentsOf(route: string): string[] {
  const segments = route.split("/").filter((segment) => segment !== "");

  return segments.length === 0 ? [HOME_PATH] : segments;
}

function titleFromSlug(slug: string): string {
  if (slug === HOME_PATH) return "Home";
  const words = slug.replace(/[-_]+/gu, " ").trim();
  if (words === "") return slug;

  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function buildPageTree(routes: readonly string[]): PageNode[] {
  const byPath = new Map<string, PageNode>();

  // Lexicographic order visits a parent route before every route it prefixes, so a node is
  // never created as a container after its own route has already been seen.
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
