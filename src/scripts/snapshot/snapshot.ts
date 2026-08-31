import { join } from "node:path";

import { readArtifact } from "#ir/artifact.ts";
import { pagesArtifact } from "#ir/pages.ts";
import { SETTLE_MS, VIEWPORTS } from "#lib/capture/defaults.ts";
import { CONCURRENCY, REQUEST_DELAY_MS, TIMEOUT_MS, USER_AGENT } from "#lib/crawl-defaults.ts";
import { createFetchClient } from "#lib/fetch/create-fetch-client/index.ts";
import { createLogger } from "#lib/logger.ts";
import { readManifest, withStep } from "#lib/manifest/index.ts";
import { openSnapshotStore } from "#lib/snapshot-store/index.ts";
import { loadRunConfig } from "#run-config/load.ts";

import {
  FREEZE_MOTION,
  LARGE_PNG_WARN_BYTES,
  NEUTRALIZE_STICKY,
  PRE_SCROLL_REMEASURE,
} from "./constants/capture-flags.ts";
import { SNAPSHOT_STEP_ID } from "./constants/ids.ts";
import { FONT_PROVIDER_USER_AGENT } from "./constants/fonts.ts";
import { LOG_RELATIVE_PATH } from "./constants/paths.ts";
import { createPlaywrightDriver } from "./create-playwright-driver.ts";
import { snapshotSite } from "./snapshot-site.ts";

export async function runSnapshot(projectPath: string, force: boolean): Promise<void> {
  const runConfig = await loadRunConfig(projectPath);

  const logger = createLogger({
    level: "info",
    filePath: join(projectPath, LOG_RELATIVE_PATH),
  });

  const client = createFetchClient({
    concurrency: CONCURRENCY,
    requestDelayMs: REQUEST_DELAY_MS,
    timeoutMs: TIMEOUT_MS,
    userAgent: USER_AGENT,
    logger,
  });

  const fontCssClient = createFetchClient({
    concurrency: CONCURRENCY,
    requestDelayMs: REQUEST_DELAY_MS,
    timeoutMs: TIMEOUT_MS,
    userAgent: FONT_PROVIDER_USER_AGENT,
    logger,
  });

  const store = await openSnapshotStore(projectPath, client);

  const manifest = await readManifest(projectPath);
  const wasSkipped = manifest.steps[SNAPSHOT_STEP_ID]?.status === "done" && !force;

  const { data: pages } = await readArtifact(projectPath, pagesArtifact);

  const driver = createPlaywrightDriver();
  try {
    await withStep(
      projectPath,
      SNAPSHOT_STEP_ID,
      () =>
        snapshotSite({
          projectPath,
          origin: new URL(runConfig.sourceUrl).origin,
          pages,
          store,
          driver,
          viewports: VIEWPORTS,
          settleMs: SETTLE_MS,
          captureStabilization: {
            freezeMotion: FREEZE_MOTION,
            neutralizeSticky: NEUTRALIZE_STICKY,
            preScrollRemeasure: PRE_SCROLL_REMEASURE,
          },
          largePngWarnBytes: LARGE_PNG_WARN_BYTES,
          logger,
          force,
          fontCssFetch: async (url) => (await fontCssClient.fetch(url)).body.toString("utf8"),
        }),
      { force },
    );
  } finally {
    await driver.close();
  }

  console.log(JSON.stringify({ step: SNAPSHOT_STEP_ID, status: wasSkipped ? "skipped" : "done" }));
}
