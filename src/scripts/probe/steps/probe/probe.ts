import { join } from "node:path";

import { CONCURRENCY, REQUEST_DELAY_MS, TIMEOUT_MS, USER_AGENT } from "#lib/crawl-defaults.ts";
import { createFetchClient } from "#lib/fetch/create-fetch-client/index.ts";
import { createLogger } from "#lib/logger.ts";
import { readManifest, withStep } from "#lib/manifest/index.ts";
import { loadRunConfig } from "#run-config/load.ts";
import { openSnapshotStore } from "#lib/snapshot-store/index.ts";

import { PROBE_STEP_ID } from "../../constants/ids.ts";
import { LOG_RELATIVE_PATH } from "../../constants/paths.ts";

import { probeSite } from "./probe-site.ts";

export async function runProbe(projectPath: string, force: boolean): Promise<void> {
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

  const store = await openSnapshotStore(projectPath, client);

  const manifest = await readManifest(projectPath);
  const wasSkipped = manifest.steps[PROBE_STEP_ID]?.status === "done" && !force;

  await withStep(
    projectPath,
    PROBE_STEP_ID,
    () => probeSite({ projectPath, sourceUrl: runConfig.sourceUrl, store, client, logger }),
    { force },
  );

  console.log(JSON.stringify({ step: PROBE_STEP_ID, status: wasSkipped ? "skipped" : "done" }));
}
