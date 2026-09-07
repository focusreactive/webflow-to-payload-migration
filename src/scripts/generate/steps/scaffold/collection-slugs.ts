import { RESERVED_COLLECTION_KEYS } from "../../constants/collections.ts";

import { slugBaseFor } from "./utils/collection-slugs.ts";

export interface CollectionSlugAssignment {
  map: Map<string, string>;
  warnings: string[];
}

export function collectionSlug(collection: { key: string; label?: string | null }): string {
  return slugBaseFor(collection);
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
        collidesWithReserved ?
          `collection "${collection.key}": slug "${base}" collides with a reserved `
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
