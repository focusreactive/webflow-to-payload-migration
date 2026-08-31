import { existsSync } from "node:fs";
import { join } from "node:path";

import type { PagesData } from "#ir/pages.ts";
import { writeFileAtomic } from "#lib/fs.ts";
import type { Logger } from "#lib/logger.ts";
import { SNAPSHOT_DIR, renderedPathFor, stylesPathFor } from "#lib/snapshot-store/paths.ts";
import type { SnapshotStore } from "#lib/snapshot-store/types.ts";
import { stitchIndexPath } from "#lib/stitch/paths.ts";

import { runFontPass } from "./run-font-pass.ts";
import type { BrowserDriver, CaptureStabilization, CaptureViewport } from "./types.ts";
import { classifyDepUrl, extractStaticDeps, serializeStyles, unionDeps } from "./utils/snapshot-site.ts";
import { writeRouteStitch } from "./write-route-stitch.ts";

export interface SnapshotSiteOpts {
  projectPath: string;
  origin: string;
  pages: PagesData;
  store: SnapshotStore;
  driver?: BrowserDriver;
  viewports: Record<string, CaptureViewport>;
  settleMs: number;
  captureStabilization: CaptureStabilization;
  largePngWarnBytes: number;
  logger: Logger;
  force?: boolean;
  fontCssFetch?: (url: string) => Promise<string>;
}

export async function snapshotSite(opts: SnapshotSiteOpts): Promise<void> {
  const {
    projectPath,
    origin,
    pages,
    store,
    driver,
    viewports,
    settleMs,
    captureStabilization,
    largePngWarnBytes,
    logger,
    force = false,
    fontCssFetch,
  } = opts;

  const staticDeps: string[] = [];
  const fetchedPages: { route: string; url: string; rawPath: string; html: string }[] = [];
  for (const page of pages.pages) {
    const url = origin + page.route;
    const entry = await store.fetchInto(url, "page");
    const html = (await store.readBody(entry)).toString("utf8");
    staticDeps.push(...extractStaticDeps(html, url));
    fetchedPages.push({ route: page.route, url, rawPath: entry.paths.raw, html });
  }

  const networkUrls: string[] = [];

  if (driver) {
    for (const { route, url, rawPath } of fetchedPages) {
      const rendered = await driver.render({ url, viewports, settleMs, stabilize: captureStabilization });

      const renderedRel = renderedPathFor(rawPath);
      const stylesRel = stylesPathFor(rawPath);

      await writeFileAtomic(join(projectPath, SNAPSHOT_DIR, renderedRel), rendered.renderedHtml);
      await writeFileAtomic(join(projectPath, SNAPSHOT_DIR, stylesRel), serializeStyles(rendered.styles));

      await store.attachDerived(url, {
        rendered: renderedRel,
        styles: stylesRel,
      });

      if (force || !existsSync(stitchIndexPath(projectPath, route))) {
        await writeRouteStitch({ projectPath, route, url, rendered, largePngWarnBytes, logger });
      }

      networkUrls.push(...rendered.networkUrls);
    }
  }

  const allDeps = unionDeps(staticDeps, networkUrls);

  for (const dep of allDeps) {
    const kind = classifyDepUrl(dep);
    if (kind === undefined) continue;

    try {
      await store.fetchInto(dep, kind);
    } catch (error) {
      logger.warn("snapshot: failed to download dependency, skipping", {
        url: dep,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (fontCssFetch !== undefined) {
    await runFontPass({
      projectPath,
      store,
      pages: fetchedPages.map(({ url, html }) => ({ url, html })),
      fetchCss: fontCssFetch,
      logger,
    });
  }
}
