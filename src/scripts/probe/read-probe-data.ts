import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { loadRunConfig } from "#run-config/load.ts";
import { openSnapshotStore, readOnlyClient } from "#lib/snapshot-store/index.ts";
import { SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";

import { PROBE_PATHS } from "./constants/paths.ts";
import type { ProbeHttpSnapshot } from "./types.ts";
import { findByRelativePath, readOkBody } from "./utils/read-probe-data.ts";

export interface ProbeData {
  sourceUrl: string;
  homeHtml: string;
  homeHttp: ProbeHttpSnapshot;
  robotsTxt?: string;
  sitemapXml?: string;
  notFound?: { html: string; status: number };
}

export async function readProbeData(projectPath: string): Promise<ProbeData> {
  const [runConfig, store] = await Promise.all([
    loadRunConfig(projectPath),
    openSnapshotStore(projectPath, readOnlyClient()),
  ]);

  const homeEntry = findByRelativePath(store, PROBE_PATHS.home);
  if (!homeEntry) {
    throw new Error(`probe has not been run for this project: ${projectPath}`);
  }

  const homeHtml = (await store.readBody(homeEntry)).toString("utf8");
  const homeHttp = JSON.parse(
    await readFile(join(projectPath, SNAPSHOT_DIR, PROBE_PATHS.headers), "utf8"),
  ) as ProbeHttpSnapshot;

  const robotsTxt = await readOkBody(store, findByRelativePath(store, PROBE_PATHS.robots));
  const sitemapXml = await readOkBody(store, findByRelativePath(store, PROBE_PATHS.sitemap));

  const notFoundEntry = findByRelativePath(store, PROBE_PATHS.notFound);
  const notFound =
    notFoundEntry ?
      {
        html: (await store.readBody(notFoundEntry)).toString("utf8"),
        status: notFoundEntry.http.status,
      }
    : undefined;

  return {
    sourceUrl: runConfig.sourceUrl,
    homeHtml,
    homeHttp,
    ...(robotsTxt !== undefined && { robotsTxt }),
    ...(sitemapXml !== undefined && { sitemapXml }),
    ...(notFound !== undefined && { notFound }),
  };
}
