import { readFile } from "node:fs/promises";

import { artifactPath, readArtifact, writeArtifact } from "#ir/artifact.ts";
import { blocksShardArtifactFor } from "#ir/discovery.ts";
import { pagesArtifact } from "#ir/pages.ts";
import { recordArtifact, updateStep } from "#lib/manifest/index.ts";
import { routeDir } from "#lib/route-dir.ts";
import { resolveSnapshotPaths } from "#lib/snapshot-store/resolve-snapshot-paths.ts";
import { readStitchIndex } from "#lib/stitch/index.ts";

import {
  DISCOVERY_BLOCKS_ACCEPT_STEP_ID,
  DISCOVERY_BLOCKS_JUDGE_STEP_ID,
  DISCOVERY_BLOCKS_SUBJECT_STEP_ID,
} from "../../constants/ids.ts";
import { blocksResponseRelativePath } from "../../constants/paths.ts";
import { blocksResponseSchema } from "../../schemas/blocks-response.ts";
import { routesMissingShard } from "../../utils/blocks-shards.ts";
import { excludeNodeIds } from "../../utils/exclude-node-ids.ts";
import { readResponse } from "../../utils/read-response.ts";
import { reportAcceptErrors } from "../../utils/report-accept-errors.ts";
import { representativeRoutes } from "../../utils/representative-routes.ts";
import { schemaErrors } from "../../utils/schema-errors.ts";

import { ingestBlocksResponse } from "./ingest-blocks-response.ts";
import { buildExcludedSet, validateBlocksResponse } from "./utils/ingest-blocks-response.ts";

export async function runBlocksAccept(projectPath: string, route: string): Promise<void> {
  const raw = await readResponse(projectPath, blocksResponseRelativePath(routeDir(route)));
  const parsed = blocksResponseSchema.safeParse(raw);
  if (!parsed.success) {
    reportAcceptErrors(schemaErrors(parsed.error.issues));
    return;
  }

  const stitchIndex = await readStitchIndex(projectPath, route);
  const { renderedHtmlPath } = await resolveSnapshotPaths(projectPath, route);
  const isExcluded = buildExcludedSet(await readFile(renderedHtmlPath, "utf8"), await excludeNodeIds(projectPath));

  const errors = validateBlocksResponse({ response: parsed.data, requestedRoute: route, stitchIndex, isExcluded });
  if (errors.length > 0) {
    reportAcceptErrors(errors);
    return;
  }

  const shardDef = blocksShardArtifactFor(routeDir(route));
  const shard = ingestBlocksResponse({ response: parsed.data, route, stitchIndex });
  await writeArtifact(projectPath, shardDef, { provenance: "ai", data: shard });
  await recordArtifact(
    projectPath,
    DISCOVERY_BLOCKS_ACCEPT_STEP_ID,
    shardDef.kind,
    artifactPath(projectPath, shardDef),
  );

  const pages = (await readArtifact(projectPath, pagesArtifact)).data;
  const remaining = routesMissingShard(projectPath, representativeRoutes(pages));
  if (remaining.length === 0) {
    const finishedAt = new Date().toISOString();
    for (const stepId of [
      DISCOVERY_BLOCKS_SUBJECT_STEP_ID,
      DISCOVERY_BLOCKS_JUDGE_STEP_ID,
      DISCOVERY_BLOCKS_ACCEPT_STEP_ID,
    ]) {
      await updateStep(projectPath, stepId, { status: "done", finishedAt });
    }
  }

  console.log(JSON.stringify({ ok: true, route, instances: shard.instances.length, remaining }));
}
