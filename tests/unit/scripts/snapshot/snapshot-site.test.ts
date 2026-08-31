import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readFile, writeFile } from "node:fs/promises";

import type { PagesData } from "#ir/pages.ts";
import { stitchIndexSchema } from "#ir/stitch.ts";
import type { FetchResponse } from "#lib/fetch/create-fetch-client/index.ts";
import { initManifest } from "#lib/manifest/index.ts";
import { openSnapshotStore } from "#lib/snapshot-store/index.ts";
import { renderedPathFor, stylesPathFor, SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";
import { snapshotSite } from "#snapshot/snapshot-site.ts";
import type { RenderedPage } from "#snapshot/types.ts";
import { serializeStyles } from "#snapshot/utils/snapshot-site.ts";
import { stitchIndexPath, stitchRouteDirPath } from "#lib/stitch/paths.ts";

import {
  createFakeDriver,
  createFakeFetchClient,
  fakeStitch,
  fetchResponse,
  silentLogger,
} from "./fixtures/snapshot.ts";

const ORIGIN = "https://example.com";

const HOME_HTML = `<html><head>
  <link rel="stylesheet" href="/style.css">
  <link rel="preload" href="/font.woff2">
</head><body><script src="/app.js"></script></body></html>`;

const ABOUT_HTML = `<html><head>
  <link rel="stylesheet" href="/style.css">
  <link rel="preload" href="/data.json">
</head><body></body></html>`;

function pagesData(): PagesData {
  return {
    pages: [
      { route: "/", kind: "static", sources: ["crawl"] },
      { route: "/about", kind: "static", sources: ["crawl"] },
    ],
    collections: [],
  };
}

function baseResponses(): Record<string, FetchResponse> {
  return {
    [`${ORIGIN}/`]: fetchResponse(`${ORIGIN}/`, {
      body: Buffer.from(HOME_HTML),
      headers: { "content-type": "text/html" },
    }),
    [`${ORIGIN}/about`]: fetchResponse(`${ORIGIN}/about`, {
      body: Buffer.from(ABOUT_HTML),
      headers: { "content-type": "text/html" },
    }),
    [`${ORIGIN}/style.css`]: fetchResponse(`${ORIGIN}/style.css`, {
      body: Buffer.from("body{}"),
    }),
    [`${ORIGIN}/app.js`]: fetchResponse(`${ORIGIN}/app.js`, {
      body: Buffer.from("console.log(1)"),
    }),
    [`${ORIGIN}/data.json`]: fetchResponse(`${ORIGIN}/data.json`, {
      body: Buffer.from("{}"),
    }),
    [`${ORIGIN}/bundle.mjs`]: fetchResponse(`${ORIGIN}/bundle.mjs`, {
      body: Buffer.from("export default 1;"),
    }),
  };
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 1 },
};

const CAPTURE_STABILIZATION = { freezeMotion: true, neutralizeSticky: true, preScrollRemeasure: true };
const LARGE_PNG_WARN_BYTES = 26_214_400;

const RENDERED_PAGE: RenderedPage = {
  renderedHtml: '<html><body data-mig-id="mig-0">rendered</body></html>',
  styles: {
    "mig-1": {
      props: { color: "red" },
      rects: { desktop: { x: 0, y: 0, width: 10, height: 10 } },
    },
    "mig-0": {
      props: { display: "block" },
      rects: { desktop: { x: 0, y: 0, width: 5, height: 5 } },
    },
  },
  stitches: {
    desktop: fakeStitch(1440, 900),
    mobile: fakeStitch(390, 844),
  },
  networkUrls: [`${ORIGIN}/bundle.mjs`],
};

describe("snapshotSite", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "snapshot-run-test-"));
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("downloads every page, extracts+downloads style/script/data deps, and skips media", async () => {
    const client = createFakeFetchClient(baseResponses());
    const store = await openSnapshotStore(projectPath, client);

    await snapshotSite({
      projectPath,
      origin: ORIGIN,
      pages: pagesData(),
      store,
      viewports: {},
      settleMs: 500,
      captureStabilization: CAPTURE_STABILIZATION,
      largePngWarnBytes: LARGE_PNG_WARN_BYTES,
      logger: silentLogger(),
    });

    expect(store.has(`${ORIGIN}/`)).toBe(true);
    expect(store.has(`${ORIGIN}/about`)).toBe(true);
    expect(store.get(`${ORIGIN}/style.css`)?.kind).toBe("style");
    expect(store.get(`${ORIGIN}/app.js`)?.kind).toBe("script");
    expect(store.get(`${ORIGIN}/data.json`)?.kind).toBe("data");
    expect(store.has(`${ORIGIN}/font.woff2`)).toBe(false);

    // style.css is referenced by both pages but must be fetched once.
    expect(client.calls).toEqual([
      `${ORIGIN}/`,
      `${ORIGIN}/about`,
      `${ORIGIN}/app.js`,
      `${ORIGIN}/data.json`,
      `${ORIGIN}/style.css`,
    ]);
  });

  it("performs zero new fetches on a second run (idempotent)", async () => {
    const client = createFakeFetchClient(baseResponses());
    const store = await openSnapshotStore(projectPath, client);

    const opts = {
      projectPath,
      origin: ORIGIN,
      pages: pagesData(),
      store,
      viewports: {},
      settleMs: 500,
      captureStabilization: CAPTURE_STABILIZATION,
      largePngWarnBytes: LARGE_PNG_WARN_BYTES,
      logger: silentLogger(),
    };

    await snapshotSite(opts);
    const callsAfterFirstRun = [...client.calls];
    expect(callsAfterFirstRun).toHaveLength(5);

    await snapshotSite(opts);

    expect(client.calls).toEqual(callsAfterFirstRun);
  });

  it("logs a warning and continues when a dependency fetch fails", async () => {
    const responses = baseResponses();
    delete responses[`${ORIGIN}/app.js`];
    const client = createFakeFetchClient(responses);
    const store = await openSnapshotStore(projectPath, client);
    const logger = silentLogger();

    await snapshotSite({
      projectPath,
      origin: ORIGIN,
      pages: pagesData(),
      store,
      viewports: {},
      settleMs: 500,
      captureStabilization: CAPTURE_STABILIZATION,
      largePngWarnBytes: LARGE_PNG_WARN_BYTES,
      logger,
    });

    expect(store.has(`${ORIGIN}/app.js`)).toBe(false);
    expect(store.has(`${ORIGIN}/style.css`)).toBe(true);
    expect(store.has(`${ORIGIN}/data.json`)).toBe(true);
    expect(logger.warnCalls).toHaveLength(1);
  });

  it("runs the Playwright pass per page when a driver is given: writes rendered/styles, downloads network deps, and stays idempotent", async () => {
    const client = createFakeFetchClient(baseResponses());
    const store = await openSnapshotStore(projectPath, client);
    const driver = createFakeDriver(RENDERED_PAGE);
    await initManifest(projectPath, { toolVersion: "0.0.0", sourceUrl: `${ORIGIN}/` });

    const opts = {
      projectPath,
      origin: ORIGIN,
      pages: pagesData(),
      store,
      driver,
      viewports: VIEWPORTS,
      settleMs: 500,
      captureStabilization: CAPTURE_STABILIZATION,
      largePngWarnBytes: LARGE_PNG_WARN_BYTES,
      logger: silentLogger(),
    };

    await snapshotSite(opts);

    // Driver invoked once per page, forwarding url + settleMs.
    expect(driver.renderCalls).toEqual([
      { url: `${ORIGIN}/`, settleMs: 500 },
      { url: `${ORIGIN}/about`, settleMs: 500 },
    ]);

    for (const url of [`${ORIGIN}/`, `${ORIGIN}/about`]) {
      const entry = store.get(url);
      expect(entry?.paths.rendered).toBeDefined();
      expect(entry?.paths.styles).toBeDefined();

      const renderedRel = entry?.paths.rendered;
      const stylesRel = entry?.paths.styles;
      if (renderedRel === undefined || stylesRel === undefined) {
        throw new Error("expected rendered/styles paths to be set");
      }

      expect(renderedRel).toBe(renderedPathFor(entry?.paths.raw ?? ""));
      expect(stylesRel).toBe(stylesPathFor(entry?.paths.raw ?? ""));

      const renderedContent = await readFile(join(projectPath, SNAPSHOT_DIR, renderedRel), "utf8");
      expect(renderedContent).toBe(RENDERED_PAGE.renderedHtml);

      const stylesContent = await readFile(join(projectPath, SNAPSHOT_DIR, stylesRel), "utf8");
      expect(stylesContent).toBe(serializeStyles(RENDERED_PAGE.styles));
    }

    // Network dep collected from the fake render (a .mjs URL) is downloaded as a script.
    expect(store.get(`${ORIGIN}/bundle.mjs`)?.kind).toBe("script");

    const callsAfterFirstRun = [...client.calls];

    await snapshotSite(opts);

    // Idempotent: no new network fetches on a second run.
    expect(client.calls).toEqual(callsAfterFirstRun);

    // Stitch capture: one PNG per viewport + validated stitch index per route.
    for (const route of ["/", "/about"] as const) {
      const stitchDir = stitchRouteDirPath(projectPath, route);
      const stitchIndex = stitchIndexSchema.parse(JSON.parse(await readFile(join(stitchDir, "index.json"), "utf8")));
      expect(stitchIndex.data.route).toBe(route);
      expect(Object.keys(stitchIndex.data.stitches).sort()).toEqual(["desktop", "mobile"]);
      expect(stitchIndex.data.stitches["desktop"]?.file).toBe("desktop.png");
      expect(stitchIndex.data.elements["mig-0"]?.desktop).toEqual({ rect: { x: 0, y: 0, width: 5, height: 5 } });
      expect(existsSync(join(stitchDir, "desktop.png"))).toBe(true);
      expect(existsSync(join(stitchDir, "mobile.png"))).toBe(true);
    }
  });

  it("skips the stitch write for routes whose stitch index already exists on disk", async () => {
    const client = createFakeFetchClient(baseResponses());
    const store = await openSnapshotStore(projectPath, client);
    await initManifest(projectPath, { toolVersion: "0.0.0", sourceUrl: `${ORIGIN}/` });

    const opts = {
      projectPath,
      origin: ORIGIN,
      pages: pagesData(),
      store,
      driver: createFakeDriver(RENDERED_PAGE),
      viewports: VIEWPORTS,
      settleMs: 500,
      captureStabilization: CAPTURE_STABILIZATION,
      largePngWarnBytes: LARGE_PNG_WARN_BYTES,
      logger: silentLogger(),
    };
    await snapshotSite(opts);

    const indexPath = stitchIndexPath(projectPath, "/");
    await writeFile(indexPath, "tampered");
    await snapshotSite(opts);

    expect(await readFile(indexPath, "utf8")).toBe("tampered");
  });

  it("re-writes the stitch index when forced", async () => {
    const client = createFakeFetchClient(baseResponses());
    const store = await openSnapshotStore(projectPath, client);
    await initManifest(projectPath, { toolVersion: "0.0.0", sourceUrl: `${ORIGIN}/` });

    const opts = {
      projectPath,
      origin: ORIGIN,
      pages: pagesData(),
      store,
      driver: createFakeDriver(RENDERED_PAGE),
      viewports: VIEWPORTS,
      settleMs: 500,
      captureStabilization: CAPTURE_STABILIZATION,
      largePngWarnBytes: LARGE_PNG_WARN_BYTES,
      logger: silentLogger(),
    };
    await snapshotSite(opts);

    const indexPath = stitchIndexPath(projectPath, "/");
    await writeFile(indexPath, "tampered");
    await snapshotSite({ ...opts, force: true });

    const parsed = stitchIndexSchema.parse(JSON.parse(await readFile(indexPath, "utf8")));
    expect(parsed.data.route).toBe("/");
  });
});
