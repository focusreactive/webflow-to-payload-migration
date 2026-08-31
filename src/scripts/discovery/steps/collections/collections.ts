import { artifactPath, readArtifact, writeArtifact } from "#ir/artifact.ts";
import { blocksShardArtifactFor, discoveryCollectionsArtifact, type BlocksShardData } from "#ir/discovery.ts";
import { pagesArtifact } from "#ir/pages.ts";
import { recordArtifact, withStep } from "#lib/manifest/index.ts";
import { routeDir } from "#lib/route-dir.ts";

import { DISCOVERY_COLLECTIONS_STEP_ID } from "../../constants/ids.ts";
import { hasBlocksShard } from "../../utils/blocks-shards.ts";

import { buildCollectionsInventory } from "./build-collections-inventory.ts";

export async function runCollections(projectPath: string, force: boolean): Promise<void> {
  const status = await withStep(
    projectPath,
    DISCOVERY_COLLECTIONS_STEP_ID,
    async () => {
      const pages = (await readArtifact(projectPath, pagesArtifact)).data;
      const shardByRoute = new Map<string, BlocksShardData>();
      for (const page of pages.pages) {
        if (page.kind !== "item" || !hasBlocksShard(projectPath, page.route)) continue;
        const { data } = await readArtifact(projectPath, blocksShardArtifactFor(routeDir(page.route)));
        shardByRoute.set(page.route, data);
      }

      const data = buildCollectionsInventory({ pages, shardFor: (route) => shardByRoute.get(route) });
      await writeArtifact(projectPath, discoveryCollectionsArtifact, { provenance: "published", data });
      await recordArtifact(
        projectPath,
        DISCOVERY_COLLECTIONS_STEP_ID,
        discoveryCollectionsArtifact.kind,
        artifactPath(projectPath, discoveryCollectionsArtifact),
      );
      return data;
    },
    { force },
  );

  console.log(
    JSON.stringify({
      step: DISCOVERY_COLLECTIONS_STEP_ID,
      status: status !== undefined ? "done" : "skipped",
    }),
  );
}
