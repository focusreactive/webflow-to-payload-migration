import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { readArtifact } from "#ir/artifact.ts";
import { pagesArtifact } from "#ir/pages.ts";
import { routeDir } from "#lib/route-dir.ts";
import { resolveSnapshotPaths } from "#lib/snapshot-store/resolve-snapshot-paths.ts";

import { DISCOVERY_BLOCKS_SUBJECT_STEP_ID } from "../constants/ids.ts";
import { blocksResponseRelativePath } from "../constants/paths.ts";
import { routesMissingShard } from "../utils/blocks-shards.ts";
import { excludeNodeIds } from "../utils/exclude-node-ids.ts";
import { representativeRoutes } from "../utils/representative-routes.ts";
import { writeDownscaledStitch } from "../utils/write-downscaled-stitch.ts";

export async function runBlocksSubject(projectPath: string, route: string | undefined): Promise<void> {
  const pages = (await readArtifact(projectPath, pagesArtifact)).data;

  if (route === undefined) {
    const remaining = routesMissingShard(projectPath, representativeRoutes(pages));
    console.log(JSON.stringify({ step: DISCOVERY_BLOCKS_SUBJECT_STEP_ID, remaining }, null, 2));
    return;
  }

  const { renderedHtmlPath } = await resolveSnapshotPaths(projectPath, route);
  const responsePath = join(projectPath, blocksResponseRelativePath(routeDir(route)));
  await mkdir(dirname(responsePath), { recursive: true });

  console.log(
    JSON.stringify(
      {
        route,
        stitchDownscaledPath: await writeDownscaledStitch(projectPath, route),
        renderedHtmlPath,
        excludeNodeIds: await excludeNodeIds(projectPath),
        responsePath,
      },
      null,
      2,
    ),
  );
}
