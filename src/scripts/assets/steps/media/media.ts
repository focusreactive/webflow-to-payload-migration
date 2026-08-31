import { join } from "node:path";

import { artifactPath, readArtifact, writeArtifact } from "#ir/artifact.ts";
import { mediaAssetsArtifact, type MediaAssetsData } from "#ir/assets.ts";
import { CONCURRENCY, REQUEST_DELAY_MS, TIMEOUT_MS, USER_AGENT } from "#lib/crawl-defaults.ts";
import { createFetchClient } from "#lib/fetch/create-fetch-client/index.ts";
import { createLogger } from "#lib/logger.ts";
import { readManifest, recordArtifact, withStep } from "#lib/manifest/index.ts";
import { openSnapshotStore } from "#lib/snapshot-store/index.ts";

import { ASSETS_MEDIA_STEP_ID } from "../../constants/ids.ts";
import { LOG_RELATIVE_PATH } from "../../constants/paths.ts";
import { mediaNormalizerFor } from "../../media-normalizer-for.ts";

import { buildMediaAssets } from "./build-media-assets.ts";

export async function runMedia(projectPath: string, force: boolean): Promise<void> {
  const logger = createLogger({
    level: "info",
    filePath: join(projectPath, LOG_RELATIVE_PATH),
  });

  const normalizer = mediaNormalizerFor();

  const client = createFetchClient({
    concurrency: CONCURRENCY,
    requestDelayMs: REQUEST_DELAY_MS,
    timeoutMs: TIMEOUT_MS,
    userAgent: USER_AGENT,
    logger,
  });

  const store = await openSnapshotStore(projectPath, client);

  const manifest = await readManifest(projectPath);
  const wasSkipped = manifest.steps[ASSETS_MEDIA_STEP_ID]?.status === "done" && !force;

  const computed = await withStep(
    projectPath,
    ASSETS_MEDIA_STEP_ID,
    async () => {
      const data = await buildMediaAssets({ store, normalizer, logger });
      await writeArtifact(projectPath, mediaAssetsArtifact, {
        provenance: "published",
        data,
      });
      await recordArtifact(projectPath, ASSETS_MEDIA_STEP_ID, "media", artifactPath(projectPath, mediaAssetsArtifact));
      return data;
    },
    { force },
  );

  const data: MediaAssetsData =
    wasSkipped ? (await readArtifact(projectPath, mediaAssetsArtifact)).data : (computed as MediaAssetsData);

  console.log(
    JSON.stringify({
      step: ASSETS_MEDIA_STEP_ID,
      status: wasSkipped ? "skipped" : "done",
      assets: data.assets.length,
      failed: data.assets.filter((asset) => asset.status === "failed").length,
    }),
  );
}
