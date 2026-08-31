import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FetchClient } from "#lib/fetch/create-fetch-client/index.ts";
import { readProbeData } from "#probe/read-probe-data.ts";
import { probeSite } from "#probe/steps/probe/probe-site.ts";
import { openSnapshotStore } from "#lib/snapshot-store/index.ts";

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
} from "./fixtures/probe.ts";

describe("readProbeData", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "probe-read-test-"));
    await writeConfig(projectPath);
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  async function probe(client: FetchClient): Promise<void> {
    const store = await openSnapshotStore(projectPath, client);

    await probeSite({
      projectPath,
      sourceUrl: SOURCE_URL,
      store,
      client,
      logger: silentLogger(),
    });
  }

  it("round-trips home html/status/redirectChain and includes robots/sitemap/notFound", async () => {
    await probe(
      createFakeFetchClient({
        [ROBOTS_URL]: fetchResponse(ROBOTS_URL, { body: Buffer.from("User-agent: *\n") }),
        [SOURCE_URL]: fetchResponse(SOURCE_URL, {
          status: 200,
          finalUrl: `${ORIGIN}/landed`,
          redirectChain: [SOURCE_URL],
          body: Buffer.from("<html>home</html>"),
          headers: { "content-type": "text/html" },
        }),
        [SITEMAP_URL]: fetchResponse(SITEMAP_URL, { body: Buffer.from("<urlset></urlset>") }),
        [NOT_FOUND_URL]: fetchResponse(NOT_FOUND_URL, { status: 404, body: Buffer.from("nope") }),
      }),
    );

    const data = await readProbeData(projectPath);

    expect(data.sourceUrl).toBe(SOURCE_URL);
    expect(data.homeHtml).toBe("<html>home</html>");
    expect(data.homeHttp.status).toBe(200);
    expect(data.homeHttp.finalUrl).toBe(`${ORIGIN}/landed`);
    expect(data.homeHttp.redirectChain).toEqual([SOURCE_URL]);
    expect(data.robotsTxt).toBe("User-agent: *\n");
    expect(data.sitemapXml).toBe("<urlset></urlset>");
    expect(data.notFound).toEqual({ html: "nope", status: 404 });
  });

  it("leaves robotsTxt undefined when robots.txt 404s", async () => {
    await probe(
      createFakeFetchClient({
        [ROBOTS_URL]: fetchResponse(ROBOTS_URL, { status: 404, body: Buffer.from("no robots here") }),
        [SOURCE_URL]: fetchResponse(SOURCE_URL, { body: Buffer.from("<html>home</html>") }),
        [SITEMAP_URL]: fetchResponse(SITEMAP_URL, { status: 404 }),
        [NOT_FOUND_URL]: fetchResponse(NOT_FOUND_URL, { status: 404 }),
      }),
    );

    const data = await readProbeData(projectPath);

    expect(data.robotsTxt).toBeUndefined();
    expect(data.sitemapXml).toBeUndefined();
  });

  it("surfaces the fallback sitemap content when the root sitemap 404s", async () => {
    const altSitemapUrl = `${ORIGIN}/sitemap-alt.xml`;
    await probe(
      createFakeFetchClient({
        [ROBOTS_URL]: fetchResponse(ROBOTS_URL, { body: Buffer.from(`User-agent: *\nSitemap: ${altSitemapUrl}\n`) }),
        [SOURCE_URL]: fetchResponse(SOURCE_URL, { body: Buffer.from("<html>home</html>") }),
        [SITEMAP_URL]: fetchResponse(SITEMAP_URL, { status: 404, body: Buffer.from("root gone") }),
        [altSitemapUrl]: fetchResponse(altSitemapUrl, { body: Buffer.from("<urlset><fallback/></urlset>") }),
        [NOT_FOUND_URL]: fetchResponse(NOT_FOUND_URL, { status: 404 }),
      }),
    );

    const data = await readProbeData(projectPath);

    // The root-sitemap entry (404) and the fallback entry (200) both point at
    // PROBE_PATHS.sitemap; readProbeData must select the successful one, not
    // report sitemapXml as undefined.
    expect(data.sitemapXml).toBe("<urlset><fallback/></urlset>");
  });

  it("records the full home response header set in homeHttp.headers", async () => {
    await probe(
      createFakeFetchClient({
        [ROBOTS_URL]: fetchResponse(ROBOTS_URL, { body: Buffer.from("User-agent: *\n") }),
        [SOURCE_URL]: fetchResponse(SOURCE_URL, {
          body: Buffer.from("<html>home</html>"),
          headers: {
            "content-type": "text/html",
            server: "some-edge/1.0",
            "x-wf-page": "abc",
            "surrogate-key": "sk-123",
          },
        }),
        [SITEMAP_URL]: fetchResponse(SITEMAP_URL, { body: Buffer.from("<urlset></urlset>") }),
        [NOT_FOUND_URL]: fetchResponse(NOT_FOUND_URL, { status: 404 }),
      }),
    );

    const data = await readProbeData(projectPath);

    // Signal headers used by the later `detect` step must survive into
    // headers.json — they are not retained by the SnapshotEntry.
    expect(data.homeHttp.headers).toMatchObject({
      "content-type": "text/html",
      server: "some-edge/1.0",
      "x-wf-page": "abc",
      "surrogate-key": "sk-123",
    });
  });

  it("throws a clear error when probe has not been run for the project", async () => {
    await expect(readProbeData(projectPath)).rejects.toThrow(/probe has not been run/);
  });
});
