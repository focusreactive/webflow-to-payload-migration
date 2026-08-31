import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { readArtifact } from "#ir/artifact.ts";
import { pagesArtifact } from "#ir/pages.ts";
import { updateStep } from "#lib/manifest/index.ts";
import { stitchPngPath } from "#lib/stitch/paths.ts";

import { DISCOVERY_DEDUP_SUBJECT_STEP_ID } from "../../constants/ids.ts";
import { DEDUP_RESPONSE_RELATIVE_PATH } from "../../constants/paths.ts";
import { readStaticBlocksShards } from "../../utils/blocks-shards.ts";

import { buildDedupSubject } from "./build-dedup-subject.ts";

export async function runDedupSubject(projectPath: string): Promise<void> {
  const pages = (await readArtifact(projectPath, pagesArtifact)).data;
  const shards = await readStaticBlocksShards(projectPath, pages);

  const stitchByRoute: Record<string, string> = {};
  for (const shard of shards) stitchByRoute[shard.route] = stitchPngPath(projectPath, shard.route, "desktop");

  const subject = buildDedupSubject({ instances: shards.flatMap((shard) => shard.data.instances) });
  const responsePath = join(projectPath, DEDUP_RESPONSE_RELATIVE_PATH);
  await mkdir(dirname(responsePath), { recursive: true });

  console.log(JSON.stringify({ ...subject, stitchByRoute, responsePath }, null, 2));

  await updateStep(projectPath, DISCOVERY_DEDUP_SUBJECT_STEP_ID, {
    status: "done",
    finishedAt: new Date().toISOString(),
  });
}
