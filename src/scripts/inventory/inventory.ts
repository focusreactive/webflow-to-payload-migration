import { join } from "node:path";

import { buildPagesData } from "#adapters/shared/pages.ts";
import { collectSitemapUrls } from "#adapters/shared/sitemap-collect.ts";
import { artifactPath, readArtifact, writeArtifact } from "#ir/artifact.ts";
import { detectArtifact } from "#ir/detect.ts";
import { pagesArtifact, type PagesData } from "#ir/pages.ts";
import { CONCURRENCY, MAX_PAGES, REQUEST_DELAY_MS, TIMEOUT_MS, USER_AGENT } from "#lib/crawl-defaults.ts";
import { createFetchClient } from "#lib/fetch/create-fetch-client/index.ts";
import { createLogger } from "#lib/logger.ts";
import { readManifest, recordArtifact, withStep } from "#lib/manifest/index.ts";
import { readProbeData } from "#probe/read-probe-data.ts";
import { loadRunConfig } from "#run-config/load.ts";
import { openSnapshotStore } from "#lib/snapshot-store/index.ts";

import { INVENTORY_STEP_ID } from "./constants/ids.ts";
import { LOG_RELATIVE_PATH } from "./constants/paths.ts";
import { inventoryCrawlerFor } from "./inventory-crawler-for.ts";

export async function runInventory(projectPath: string, force: boolean): Promise<void> {
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

  const crawl = inventoryCrawlerFor();

  const manifest = await readManifest(projectPath);
  const wasSkipped = manifest.steps[INVENTORY_STEP_ID]?.status === "done" && !force;

  const computed = await withStep(
    projectPath,
    INVENTORY_STEP_ID,
    async () => {
      const probe = await readProbeData(projectPath);
      const detect = await readArtifact(projectPath, detectArtifact);
      const origin = new URL(runConfig.sourceUrl).origin;

      const sitemapUrls = await collectSitemapUrls({
        rootSitemapXml: probe.sitemapXml,
        store,
        logger,
      });

      const { pages, warnings } = await crawl({
        origin,
        sourceUrl: runConfig.sourceUrl,
        sitemapUrls,
        platformHints: detect.data.platformHints,
        store,
        maxPages: MAX_PAGES,
        logger,
      });

      if (warnings.length > 0) {
        logger.info("inventory: crawl finished with warnings", {
          warningCount: warnings.length,
        });
      }

      const data = buildPagesData(pages);
      await writeArtifact(projectPath, pagesArtifact, {
        provenance: "published",
        data,
      });
      await recordArtifact(projectPath, INVENTORY_STEP_ID, "pages", artifactPath(projectPath, pagesArtifact));

      return data;
    },
    { force },
  );

  const data: PagesData = wasSkipped ? (await readArtifact(projectPath, pagesArtifact)).data : (computed as PagesData);

  console.log(
    JSON.stringify({
      step: INVENTORY_STEP_ID,
      status: wasSkipped ? "skipped" : "done",
      pages: data.pages.length,
      collections: data.collections.length,
    }),
  );
}
