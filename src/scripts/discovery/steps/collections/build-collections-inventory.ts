import { collectionIdSchema } from "#ir/common.ts";
import type { BlocksShardData, DiscoveryCollectionsData } from "#ir/discovery.ts";
import type { PagesData } from "#ir/pages.ts";

import { mintSectionId } from "./utils/build-collections-inventory.ts";

export function buildCollectionsInventory(opts: {
  pages: PagesData;
  shardFor: (route: string) => BlocksShardData | undefined;
}): DiscoveryCollectionsData {
  const seen = new Set<string>();
  const types = [];
  for (const page of opts.pages.pages) {
    if (page.kind !== "item" || page.collectionKey === undefined || seen.has(page.collectionKey)) continue;
    seen.add(page.collectionKey);
    const shard = opts.shardFor(page.route);
    const used = new Set<string>();
    const sections = [...(shard?.instances ?? [])]
      .sort((a, b) => (a.boundaries["desktop"]?.rect.y ?? 0) - (b.boundaries["desktop"]?.rect.y ?? 0))
      .map((instance) => ({
        id: mintSectionId(instance.role, used),
        role: instance.role,
        summary: instance.summary,
        nodeIds: instance.nodeIds,
        boundaries: instance.boundaries,
      }));
    types.push({
      collectionKey: collectionIdSchema.parse(page.collectionKey),
      representativeItem: { route: page.route, ...(page.slug !== undefined ? { slug: page.slug } : {}) },
      sections,
    });
  }
  return { types };
}
