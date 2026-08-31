import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FetchClient } from "#lib/fetch/create-fetch-client/index.ts";
import { PROBE_PATHS } from "#probe/constants/paths.ts";
import { probeSite } from "#probe/steps/probe/probe-site.ts";
import { openSnapshotStore } from "#lib/snapshot-store/index.ts";
import type { SnapshotStore } from "#lib/snapshot-store/types.ts";

import {
  createFakeFetchClient,
  fetchResponse,
  NOT_FOUND_URL,
  ORIGIN,
  ROBOTS_URL,
  silentLogger,
  SITEMAP_URL,
  SOURCE_URL,
  writeConfig,
} from "../../fixtures/probe.ts";

describe("probeSite", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "probe-test-"));
    await writeConfig(projectPath);
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  async function openStore(client: FetchClient): Promise<SnapshotStore> {
    return openSnapshotStore(projectPath, client);
  }

  async function run(store: SnapshotStore, client: FetchClient): Promise<void> {
    await probeSite({
      projectPath,
      sourceUrl: SOURCE_URL,
      store,
      client,
      logger: silentLogger(),
    });
  }

  it("fetches robots/home/sitemap/404 and writes 5 files with 4 registry entries (headers.json excluded)", async () => {
    const client = createFakeFetchClient({
      [ROBOTS_URL]: fetchResponse(ROBOTS_URL, { body: Buffer.from("User-agent: *\n") }),
      [SOURCE_URL]: fetchResponse(SOURCE_URL, {
        body: Buffer.from("<html>home</html>"),
        headers: { "content-type": "text/html" },
      }),
      [SITEMAP_URL]: fetchResponse(SITEMAP_URL, { body: Buffer.from("<urlset></urlset>") }),
      [NOT_FOUND_URL]: fetchResponse(NOT_FOUND_URL, { status: 404, body: Buffer.from("nope") }),
    });
    const store = await openStore(client);

    await run(store, client);

    expect(store.entries()).toHaveLength(4);
    expect(
      store
        .entries()
        .map((entry) => entry.paths.raw)
        .sort(),
    ).toEqual([PROBE_PATHS.robots, PROBE_PATHS.home, PROBE_PATHS.sitemap, PROBE_PATHS.notFound].sort());
    expect(store.get(NOT_FOUND_URL)?.http.status).toBe(404);
    expect(client.calls).toEqual([ROBOTS_URL, SOURCE_URL, SITEMAP_URL, NOT_FOUND_URL]);
  });

  it("passes robots crawl-delay through to the client", async () => {
    const client = createFakeFetchClient({
      [ROBOTS_URL]: fetchResponse(ROBOTS_URL, { body: Buffer.from("User-agent: *\nCrawl-delay: 2\n") }),
      [SOURCE_URL]: fetchResponse(SOURCE_URL),
      [SITEMAP_URL]: fetchResponse(SITEMAP_URL),
      [NOT_FOUND_URL]: fetchResponse(NOT_FOUND_URL, { status: 404 }),
    });
    const store = await openStore(client);

    await run(store, client);

    expect(client.crawlDelayCalls).toEqual([2000]);
  });

  it("falls back to the first same-origin robots Sitemap directive when the root sitemap 404s", async () => {
    const altSitemapUrl = `${ORIGIN}/sitemap-alt.xml`;
    const client = createFakeFetchClient({
      [ROBOTS_URL]: fetchResponse(ROBOTS_URL, {
        body: Buffer.from(
          `User-agent: *\nSitemap: ${altSitemapUrl}\nSitemap: https://other-origin.example/sitemap.xml\n`,
        ),
      }),
      [SOURCE_URL]: fetchResponse(SOURCE_URL),
      [SITEMAP_URL]: fetchResponse(SITEMAP_URL, { status: 404, body: Buffer.from("not found") }),
      [altSitemapUrl]: fetchResponse(altSitemapUrl, { body: Buffer.from("<urlset><alt/></urlset>") }),
      [NOT_FOUND_URL]: fetchResponse(NOT_FOUND_URL, { status: 404 }),
    });
    const store = await openStore(client);

    await run(store, client);

    expect(client.calls).toContain(altSitemapUrl);
    const altEntry = store.get(altSitemapUrl);
    expect(altEntry?.http.status).toBe(200);
    expect(altEntry?.paths.raw).toBe(PROBE_PATHS.sitemap);
    await expect(store.readBody(store.get(altSitemapUrl)!)).resolves.toEqual(Buffer.from("<urlset><alt/></urlset>"));
  });

  it("probes the fixed 404 path at the origin", async () => {
    const client = createFakeFetchClient({
      [ROBOTS_URL]: fetchResponse(ROBOTS_URL, { status: 404 }),
      [SOURCE_URL]: fetchResponse(SOURCE_URL),
      [SITEMAP_URL]: fetchResponse(SITEMAP_URL, { status: 404 }),
      [NOT_FOUND_URL]: fetchResponse(NOT_FOUND_URL, { status: 404, body: Buffer.from("nothing here") }),
    });
    const store = await openStore(client);

    await run(store, client);

    expect(client.calls).toContain(NOT_FOUND_URL);
    expect(store.get(NOT_FOUND_URL)?.http.status).toBe(404);
  });

  it("performs zero new fetches on a second run (store idempotency)", async () => {
    const altSitemapUrl = `${ORIGIN}/sitemap-alt.xml`;
    const client = createFakeFetchClient({
      [ROBOTS_URL]: fetchResponse(ROBOTS_URL, { body: Buffer.from(`User-agent: *\nSitemap: ${altSitemapUrl}\n`) }),
      [SOURCE_URL]: fetchResponse(SOURCE_URL),
      [SITEMAP_URL]: fetchResponse(SITEMAP_URL, { status: 404 }),
      [altSitemapUrl]: fetchResponse(altSitemapUrl),
      [NOT_FOUND_URL]: fetchResponse(NOT_FOUND_URL, { status: 404 }),
    });
    const store = await openStore(client);

    await run(store, client);
    const callsAfterFirstRun = [...client.calls];
    expect(callsAfterFirstRun).toHaveLength(5);

    await run(store, client);

    expect(client.calls).toEqual(callsAfterFirstRun);
  });
});
