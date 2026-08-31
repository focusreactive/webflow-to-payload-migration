import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { anchorPaths } from "#lib/anchor-path.ts";
import { renderedByRoute } from "#lib/snapshot-store/index.ts";
import { SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";
import type { SnapshotStore } from "#lib/snapshot-store/types.ts";

export interface AnchorMaps {
  forRoute(route: string): Promise<string | undefined>;
}

export function createAnchorMaps(opts: { projectPath: string; store: SnapshotStore }): AnchorMaps {
  const renderedPaths = renderedByRoute(opts.store);
  const serialized = new Map<string, string>();

  return {
    async forRoute(route: string): Promise<string | undefined> {
      const cached = serialized.get(route);
      if (cached !== undefined) return cached;

      const relativePath = renderedPaths.get(route);
      if (relativePath === undefined) return undefined;

      const html = await readFile(join(opts.projectPath, SNAPSHOT_DIR, relativePath), "utf8");
      const json = JSON.stringify(anchorPaths(html));
      serialized.set(route, json);

      return json;
    },
  };
}
