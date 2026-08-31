import type { FetchClient } from "#lib/fetch/create-fetch-client/index.ts";
import { parseRobots } from "#lib/fetch/robots.ts";
import type { Logger } from "#lib/logger.ts";

import { HTTP_ERROR_STATUS_THRESHOLD } from "../../constants/http.ts";
import { PROBE_404_PATH, PROBE_PATHS } from "../../constants/paths.ts";

import { firstSameOriginSitemapUrl } from "./utils/fetch-probe-targets.ts";

export interface ProbeFetchResult {
  status: number;
  readBody: () => Promise<Buffer>;
}

export type ProbeFetch = (url: string, relativePath: string) => Promise<ProbeFetchResult>;

export async function fetchProbeTargets(opts: {
  sourceUrl: string;
  client: FetchClient;
  logger: Logger;
  fetch: ProbeFetch;
}): Promise<void> {
  const { sourceUrl, client, logger, fetch } = opts;
  const origin = new URL(sourceUrl).origin;

  const robotsResult = await fetch(`${origin}/robots.txt`, PROBE_PATHS.robots);

  let sitemapUrls: string[] = [];
  if (robotsResult.status < HTTP_ERROR_STATUS_THRESHOLD) {
    const robotsBody = await robotsResult.readBody();
    const robotsInfo = parseRobots(robotsBody.toString("utf8"));
    sitemapUrls = robotsInfo.sitemapUrls;
    if (robotsInfo.crawlDelayMs !== undefined) {
      client.setCrawlDelayMs(robotsInfo.crawlDelayMs);
      logger.info("probe: applying crawl-delay from robots.txt", {
        crawlDelayMs: robotsInfo.crawlDelayMs,
      });
    }
  } else {
    logger.debug("probe: robots.txt unavailable, skipping", {
      status: robotsResult.status,
    });
  }

  await fetch(sourceUrl, PROBE_PATHS.home);

  const rootSitemapResult = await fetch(`${origin}/sitemap.xml`, PROBE_PATHS.sitemap);
  if (rootSitemapResult.status >= HTTP_ERROR_STATUS_THRESHOLD) {
    const sameOriginSitemapUrl = firstSameOriginSitemapUrl(sitemapUrls, origin);
    if (sameOriginSitemapUrl !== undefined) {
      logger.info("probe: root sitemap missing, trying robots directive", {
        sitemapUrl: sameOriginSitemapUrl,
      });

      await fetch(sameOriginSitemapUrl, PROBE_PATHS.sitemap);
    }
  }

  await fetch(`${origin}${PROBE_404_PATH}`, PROBE_PATHS.notFound);
}
