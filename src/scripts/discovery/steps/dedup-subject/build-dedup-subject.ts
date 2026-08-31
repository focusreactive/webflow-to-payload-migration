import type { BlockInstance } from "#ir/discovery.ts";

import type { DedupSubject } from "../../types.ts";

export function buildDedupSubject(args: { instances: BlockInstance[] }): DedupSubject {
  return {
    instances: args.instances.map((instance) => ({
      route: instance.route,
      nodeIds: instance.nodeIds,
      role: instance.role,
      summary: instance.summary,
      rectsByViewport: Object.fromEntries(
        Object.entries(instance.boundaries).map(([viewport, entry]) => [viewport, entry.rect]),
      ),
    })),
  };
}
