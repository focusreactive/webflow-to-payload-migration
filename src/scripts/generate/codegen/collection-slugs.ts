// Slugs a migrated collection must never take: the ones the generated shell registers itself
// (page/pages/media/users), the chrome globals (header/footer/globalBlock), and names Payload
// plugins commonly claim. This is the single source of truth both the disambiguation seed
// below and codegen/collections.ts's collision guard read from — two separate lists guarding
// the same hazard is exactly how a migrated "Header" collection once duplicated the shell's
// own "header" slug.
export const RESERVED_COLLECTION_KEYS: ReadonlySet<string> = new Set([
  "page",
  "pages",
  "media",
  "users",
  "header",
  "footer",
  "globalBlock",
  "redirects",
  "presets",
  "comments",
  "comment-reads",
  "ab-experiments",
  "payload-mcp-api-keys",
]);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureLetterLeading(base: string): string {
  if (base === "") return "collection";

  return /^[a-z]/.test(base) ? base : `c-${base}`;
}

export function collectionSlug(collection: { key: string; label?: string | null }): string {
  const fromLabel = slugify(collection.label ?? "");
  const base = fromLabel !== "" ? fromLabel : slugify(collection.key);

  return ensureLetterLeading(base);
}

export interface CollectionSlugAssignment {
  map: Map<string, string>;
  warnings: string[];
}

export function buildCollectionSlugMap(
  collections: readonly { key: string; label?: string | null }[],
): CollectionSlugAssignment {
  const used = new Set<string>(RESERVED_COLLECTION_KEYS);
  const map = new Map<string, string>();
  const warnings: string[] = [];

  for (const collection of collections) {
    const base = collectionSlug(collection);
    const collidesWithReserved = RESERVED_COLLECTION_KEYS.has(base);

    let slug = base;
    let n = 2;

    while (used.has(slug)) {
      slug = `${base}-${n}`;
      n += 1;
    }

    if (slug !== base) {
      warnings.push(
        collidesWithReserved
          ? `collection "${collection.key}": slug "${base}" collides with a reserved `
              + `collection; renamed to "${slug}" (its URLs use "${slug}", not "${base}")`
          : `collection "${collection.key}": slug "${base}" collides with another migrated `
              + `collection; renamed to "${slug}" (its URLs use "${slug}", not "${base}")`,
      );
    }

    used.add(slug);
    map.set(String(collection.key), slug);
  }

  return { map, warnings };
}

export function emitCollectionSlugsFile(map: ReadonlyMap<string, string>): string {
  const entries = [...map.entries()]
    .map(([key, slug]) => `  ${JSON.stringify(key)}: ${JSON.stringify(slug)},`)
    .join("\n");
  return (
    `// Webflow collection key -> Payload collection slug (generated).\n`
    + `export const collectionSlugs: Record<string, string> = {\n${entries}\n};\n`
  );
}
