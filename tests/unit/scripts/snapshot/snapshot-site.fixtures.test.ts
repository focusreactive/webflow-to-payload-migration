import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPagesData } from "#adapters/shared/pages.ts";
import { collectSitemapUrls } from "#adapters/shared/sitemap-collect.ts";
import { crawlWebflow } from "#adapters/webflow/crawl.ts";
import type { FetchClient, FetchResponse } from "#lib/fetch/create-fetch-client/index.ts";
import { createLogger } from "#lib/logger.ts";
import { initManifest } from "#lib/manifest/index.ts";
import { normalizeUrl } from "#lib/url.ts";
import { openSnapshotStore } from "#lib/snapshot-store/index.ts";
import { renderedPathFor, stylesPathFor, SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";
import { snapshotSite } from "#snapshot/snapshot-site.ts";
import type { RenderedPage } from "#snapshot/types.ts";
import { serializeStyles } from "#snapshot/utils/snapshot-site.ts";

import { loadInventoryFixture } from "../../../fixtures/inventory/load.ts";
import { createFakeDriver, fakeStitch, fetchResponse } from "./fixtures/snapshot.ts";

const FIXTURE_DIR = join(import.meta.dirname, "../../../fixtures/inventory/webflow/j-magazine");

// Discovered only via the fake driver's networkUrls (not present in any
// fixture page body) — exercises the same script-download path a real
// bundler chunk emitted at runtime would take.
const DEP_SCRIPT_URL = "https://assets.example-cdn.test/bundle.mjs";
// Unclassified extension: must never be downloaded by the snapshot service.
const DEP_MEDIA_URL = "https://assets.example-cdn.test/hero.png";

const VIEWPORTS = { desktop: { width: 1440, height: 900, deviceScaleFactor: 1 } };
const CAPTURE_STABILIZATION = { freezeMotion: true, neutralizeSticky: true, preScrollRemeasure: true };
const LARGE_PNG_WARN_BYTES = 26_214_400;

const RENDERED_PAGE: RenderedPage = {
  renderedHtml: '<html><body data-mig-id="mig-0">rendered</body></html>',
  styles: {
    "mig-0": {
      props: { display: "block" },
      rects: { desktop: { x: 0, y: 0, width: 10, height: 10 } },
    },
  },
  stitches: {
    desktop: fakeStitch(1440, 900),
  },
  networkUrls: [DEP_SCRIPT_URL, DEP_MEDIA_URL],
};

/** Wraps the committed inventory fixture's FetchClient with a couple of
 * extra absolute URLs, so the fake driver's discovered network deps
 * resolve without having to touch the fixture itself. Unmapped URLs
 * (real page bodies, their real CDN deps, sitemap.xml) fall through to
 * the fixture client unchanged. */
function withExtraResponses(base: FetchClient, extra: Record<string, FetchResponse>): FetchClient {
  return {
    fetch(url: string): Promise<FetchResponse> {
      const response = extra[normalizeUrl(url)];
      return response ? Promise.resolve(response) : base.fetch(url);
    },
    setCrawlDelayMs(ms: number): void {
      base.setCrawlDelayMs(ms);
    },
  };
}

describe("snapshotSite (fixture inventory -> pages.json -> snapshot)", () => {
  it("renders every crawled page with full store coverage, downloads the .mjs dep, and skips the media dep", async () => {
    const fixture = await loadInventoryFixture(FIXTURE_DIR);
    const origin = new URL(fixture.sourceUrl).origin;
    const client = withExtraResponses(fixture.fetchClient, {
      [normalizeUrl(DEP_SCRIPT_URL)]: fetchResponse(DEP_SCRIPT_URL),
    });

    const projectPath = await mkdtemp(join(tmpdir(), "snapshot-service-test-"));
    try {
      await initManifest(projectPath, { toolVersion: "0.0.0", sourceUrl: fixture.sourceUrl });
      const store = await openSnapshotStore(projectPath, client);
      const logger = createLogger({ level: "error" });

      // Step 1: run the real inventory pipeline against the committed
      // fixture to produce pages.json, exactly as the CLI's inventory step
      // would (same pattern as tests/unit/adapters/webflow/inventory/fixtures.test.ts).
      const sitemapLocs = await collectSitemapUrls({
        rootSitemapXml: fixture.rootSitemapXml,
        store,
        logger,
      });

      const { pages: classifiedPages } = await crawlWebflow({
        origin,
        seedUrls: [
          { url: fixture.sourceUrl, source: "crawl" },
          ...sitemapLocs.map((url) => ({ url, source: "sitemap" as const })),
        ],
        store,
        maxPages: 100,
        logger,
      });

      const pages = buildPagesData(classifiedPages);
      expect(pages.pages.length).toBeGreaterThan(0);

      // Step 2: run the snapshot service over the same store and pages.json,
      // with a fake driver returning a fixed RenderedPage for every page.
      const driver = createFakeDriver(RENDERED_PAGE);

      await snapshotSite({
        projectPath,
        origin,
        pages,
        store,
        driver,
        viewports: VIEWPORTS,
        settleMs: 0,
        captureStabilization: CAPTURE_STABILIZATION,
        largePngWarnBytes: LARGE_PNG_WARN_BYTES,
        logger,
      });

      expect(driver.renderCalls).toHaveLength(pages.pages.length);

      // Full coverage: every page in pages.json maps (origin + route) to a
      // page-kind entry in the store index, with rendered/styles derived
      // paths and files actually present on disk.
      for (const page of pages.pages) {
        const url = origin + page.route;
        const entry = store.get(url);
        if (!entry) throw new Error(`expected snapshot entry for ${url}`);

        expect(entry.kind).toBe("page");

        const renderedRel = entry.paths.rendered;
        const stylesRel = entry.paths.styles;
        if (renderedRel === undefined || stylesRel === undefined) {
          throw new Error(`expected rendered/styles paths for ${url}`);
        }
        expect(renderedRel).toBe(renderedPathFor(entry.paths.raw));
        expect(stylesRel).toBe(stylesPathFor(entry.paths.raw));

        const renderedContent = await readFile(join(projectPath, SNAPSHOT_DIR, renderedRel), "utf8");
        expect(renderedContent).toBe(RENDERED_PAGE.renderedHtml);

        const stylesContent = await readFile(join(projectPath, SNAPSHOT_DIR, stylesRel), "utf8");
        expect(stylesContent).toBe(serializeStyles(RENDERED_PAGE.styles));
      }

      // The .mjs network dep discovered by the fake render was downloaded
      // and classified as a script.
      expect(store.get(DEP_SCRIPT_URL)?.kind).toBe("script");

      // The media dep has an unclassified extension, so unionDeps filters
      // it out before any fetch is ever attempted for it.
      expect(store.has(DEP_MEDIA_URL)).toBe(false);
    } finally {
      await rm(projectPath, { recursive: true, force: true });
    }
  });
});
