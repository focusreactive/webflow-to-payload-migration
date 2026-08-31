import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { crawlWebflow } from "#adapters/webflow/crawl.ts";
import type { FetchClient, FetchResponse } from "#lib/fetch/create-fetch-client/index.ts";
import type { Logger } from "#lib/logger.ts";
import { openSnapshotStore } from "#lib/snapshot-store/index.ts";
import type { SnapshotStore } from "#lib/snapshot-store/types.ts";

const ORIGIN = "https://example.com";
const SITE_ID = "site-1";

function fetchResponse(url: string, overrides: Partial<FetchResponse> = {}): FetchResponse {
  return {
    status: 200,
    finalUrl: url,
    redirectChain: [],
    headers: { "content-type": "text/html" },
    body: Buffer.from(""),
    ...overrides,
  };
}

function createFakeFetchClient(responses: Record<string, FetchResponse>): FetchClient & { calls: string[] } {
  const calls: string[] = [];

  return {
    calls,
    fetch(url: string): Promise<FetchResponse> {
      calls.push(url);
      const response = responses[url];
      if (!response) {
        throw new Error(`fake client: no response configured for ${url}`);
      }
      return Promise.resolve(response);
    },
    setCrawlDelayMs(): void {},
  };
}

function silentLogger(): Logger {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function html(opts: {
  pageId?: string;
  siteId?: string;
  collectionKey?: string;
  slug?: string;
  body?: string;
}): string {
  const attrs = [
    opts.pageId !== undefined && `data-wf-page="${opts.pageId}"`,
    opts.siteId !== undefined && `data-wf-site="${opts.siteId}"`,
    opts.collectionKey !== undefined && `data-wf-collection="${opts.collectionKey}"`,
    opts.slug !== undefined && `data-wf-item-slug="${opts.slug}"`,
  ]
    .filter((attr): attr is string => Boolean(attr))
    .join(" ");

  return `<!doctype html><html ${attrs}><head></head><body>${opts.body ?? ""}</body></html>`;
}

function staticPage(pageId: string, body = ""): string {
  return html({ pageId, siteId: SITE_ID, body });
}

function itemPage(pageId: string, collectionKey: string, slug: string, body = ""): string {
  return html({ pageId, siteId: SITE_ID, collectionKey, slug, body });
}

function nonWebflowPage(body = ""): string {
  return `<!doctype html><html><head></head><body>${body}</body></html>`;
}

async function withStore(
  responses: Record<string, FetchResponse>,
  run: (store: SnapshotStore, client: FetchClient & { calls: string[] }) => Promise<void>,
): Promise<void> {
  const projectPath = await mkdtemp(join(tmpdir(), "crawl-test-"));
  try {
    const client = createFakeFetchClient(responses);
    const store = await openSnapshotStore(projectPath, client);
    await run(store, client);
  } finally {
    await rm(projectPath, { recursive: true, force: true });
  }
}

describe("crawlWebflow", () => {
  it("crawls a 3-page graph (home -> /works -> 2 items) into 4 ClassifiedPage records", async () => {
    const home = `${ORIGIN}/`;
    const works = `${ORIGIN}/works`;
    const item1 = `${ORIGIN}/works/item-1`;
    const item2 = `${ORIGIN}/works/item-2`;

    await withStore(
      {
        [home]: fetchResponse(home, {
          body: Buffer.from(staticPage("page-home", `<a href="/works">Works</a>`)),
        }),
        [works]: fetchResponse(works, {
          body: Buffer.from(
            staticPage("page-works", `<a href="/works/item-1">Item 1</a><a href="/works/item-2">Item 2</a>`),
          ),
        }),
        [item1]: fetchResponse(item1, {
          body: Buffer.from(itemPage("page-item-1", "col-works", "item-1")),
        }),
        [item2]: fetchResponse(item2, {
          body: Buffer.from(itemPage("page-item-2", "col-works", "item-2")),
        }),
      },
      async (store) => {
        const result = await crawlWebflow({
          origin: ORIGIN,
          seedUrls: [{ url: home, source: "crawl" }],
          store,
          maxPages: 100,
          logger: silentLogger(),
        });

        expect(result.pages).toHaveLength(4);
        expect(result.warnings).toEqual([]);

        const byRoute = new Map(result.pages.map((page) => [page.route, page]));
        expect(byRoute.get("/")).toMatchObject({
          kind: "static",
          source: "crawl",
        });
        expect(byRoute.get("/works")).toMatchObject({
          kind: "static",
          source: "crawl",
        });
        expect(byRoute.get("/works/item-1")).toMatchObject({
          kind: "item",
          collectionKey: "col-works",
          slug: "item-1",
          source: "crawl",
        });
        expect(byRoute.get("/works/item-2")).toMatchObject({
          kind: "item",
          collectionKey: "col-works",
          slug: "item-2",
          source: "crawl",
        });
      },
    );
  });

  it("does not crawl a link to a different origin", async () => {
    const home = `${ORIGIN}/`;
    const external = "https://other-domain.example/page";

    await withStore(
      {
        [home]: fetchResponse(home, {
          body: Buffer.from(staticPage("page-home", `<a href="${external}">External</a>`)),
        }),
      },
      async (store, client) => {
        const result = await crawlWebflow({
          origin: ORIGIN,
          seedUrls: [{ url: home, source: "crawl" }],
          store,
          maxPages: 100,
          logger: silentLogger(),
        });

        expect(result.pages).toHaveLength(1);
        expect(client.calls).not.toContain(external);
      },
    );
  });

  it("flags a non-webflow page with a warning, does not traverse it, and emits no record", async () => {
    const home = `${ORIGIN}/`;
    const about = `${ORIGIN}/about`;
    const secret = `${ORIGIN}/secret`;

    await withStore(
      {
        [home]: fetchResponse(home, {
          body: Buffer.from(staticPage("page-home", `<a href="/about">About</a>`)),
        }),
        [about]: fetchResponse(about, {
          body: Buffer.from(nonWebflowPage(`<a href="/secret">Secret</a>`)),
        }),
      },
      async (store, client) => {
        const result = await crawlWebflow({
          origin: ORIGIN,
          seedUrls: [{ url: home, source: "crawl" }],
          store,
          maxPages: 100,
          logger: silentLogger(),
        });

        expect(result.pages).toHaveLength(1);
        expect(result.pages[0]?.route).toBe("/");
        expect(result.warnings).toEqual([`non-webflow page: ${about}`]);
        expect(client.calls).not.toContain(secret);
      },
    );
  });

  it('follows pagination: a w-page-count "1 / 2" wrapper causes a ?seed_page=2 fetch', async () => {
    const list = `${ORIGIN}/blog`;
    const page2 = `${ORIGIN}/blog?items_page=2`;

    const paginationWrapper = `
      <div class="w-dyn-list">
        <div role="list" class="w-dyn-items"><div role="listitem" class="w-dyn-item">Item</div></div>
        <div role="navigation" aria-label="List" class="w-pagination-wrapper">
          <a href="?items_page=2" class="w-pagination-next">Next</a>
          <div class="w-page-count">1 / 2</div>
        </div>
      </div>
    `;

    await withStore(
      {
        [list]: fetchResponse(list, {
          body: Buffer.from(staticPage("page-blog", paginationWrapper)),
        }),
        [page2]: fetchResponse(page2, {
          body: Buffer.from(staticPage("page-blog-2")),
        }),
      },
      async (store, client) => {
        const result = await crawlWebflow({
          origin: ORIGIN,
          seedUrls: [{ url: list, source: "crawl" }],
          store,
          maxPages: 100,
          logger: silentLogger(),
        });

        expect(client.calls).toContain(page2);
        expect(result.pages.some((page) => page.route === "/blog")).toBe(true);
      },
    );
  });

  it("stops at maxPages, fetching exactly that many pages and warning", async () => {
    const home = `${ORIGIN}/`;
    const works = `${ORIGIN}/works`;
    const item1 = `${ORIGIN}/works/item-1`;
    const item2 = `${ORIGIN}/works/item-2`;

    await withStore(
      {
        [home]: fetchResponse(home, {
          body: Buffer.from(staticPage("page-home", `<a href="/works">Works</a>`)),
        }),
        [works]: fetchResponse(works, {
          body: Buffer.from(
            staticPage("page-works", `<a href="/works/item-1">Item 1</a><a href="/works/item-2">Item 2</a>`),
          ),
        }),
        [item1]: fetchResponse(item1, {
          body: Buffer.from(itemPage("page-item-1", "col-works", "item-1")),
        }),
        [item2]: fetchResponse(item2, {
          body: Buffer.from(itemPage("page-item-2", "col-works", "item-2")),
        }),
      },
      async (store, client) => {
        const result = await crawlWebflow({
          origin: ORIGIN,
          seedUrls: [{ url: home, source: "crawl" }],
          store,
          maxPages: 2,
          logger: silentLogger(),
        });

        expect(client.calls).toHaveLength(2);
        expect(result.warnings).toContain("maxPages reached (2)");
      },
    );
  });

  it("fetches a repeated URL only once", async () => {
    const home = `${ORIGIN}/`;
    const works = `${ORIGIN}/works`;

    await withStore(
      {
        [home]: fetchResponse(home, {
          body: Buffer.from(staticPage("page-home", `<a href="/works">Works</a><a href="/works">Works Again</a>`)),
        }),
        [works]: fetchResponse(works, {
          body: Buffer.from(staticPage("page-works")),
        }),
      },
      async (store, client) => {
        await crawlWebflow({
          origin: ORIGIN,
          seedUrls: [{ url: home, source: "crawl" }],
          store,
          maxPages: 100,
          logger: silentLogger(),
        });

        expect(client.calls.filter((call) => call === works)).toHaveLength(1);
      },
    );
  });

  it("warns on a cluster cross-check: same pageId across two different collectionKeys", async () => {
    const home = `${ORIGIN}/`;
    const itemA = `${ORIGIN}/a`;
    const itemB = `${ORIGIN}/b`;

    await withStore(
      {
        [home]: fetchResponse(home, {
          body: Buffer.from(staticPage("page-home", `<a href="/a">A</a><a href="/b">B</a>`)),
        }),
        [itemA]: fetchResponse(itemA, {
          body: Buffer.from(itemPage("shared-page-id", "col-a", "slug-a")),
        }),
        [itemB]: fetchResponse(itemB, {
          body: Buffer.from(itemPage("shared-page-id", "col-b", "slug-b")),
        }),
      },
      async (store) => {
        const result = await crawlWebflow({
          origin: ORIGIN,
          seedUrls: [{ url: home, source: "crawl" }],
          store,
          maxPages: 100,
          logger: silentLogger(),
        });

        expect(result.warnings.some((warning) => warning.includes("shared-page-id"))).toBe(true);
      },
    );
  });

  it("emits two records for a url present in both seed sources (sitemap + crawl union)", async () => {
    const home = `${ORIGIN}/`;
    const about = `${ORIGIN}/about`;

    await withStore(
      {
        [home]: fetchResponse(home, {
          body: Buffer.from(staticPage("page-home")),
        }),
        [about]: fetchResponse(about, {
          body: Buffer.from(staticPage("page-about")),
        }),
      },
      async (store) => {
        const result = await crawlWebflow({
          origin: ORIGIN,
          seedUrls: [
            { url: home, source: "crawl" },
            { url: about, source: "sitemap" },
            { url: about, source: "crawl" },
          ],
          store,
          maxPages: 100,
          logger: silentLogger(),
        });

        const aboutRecords = result.pages.filter((page) => page.route === "/about");
        expect(aboutRecords).toHaveLength(2);
        expect(aboutRecords.map((record) => record.source).sort()).toEqual(["crawl", "sitemap"]);
      },
    );
  });

  it("unions sources discovered after a URL was already dequeued (late-discovered source)", async () => {
    const home = `${ORIGIN}/`;
    const about = `${ORIGIN}/about`;
    const other = `${ORIGIN}/other`;

    await withStore(
      {
        [home]: fetchResponse(home, {
          body: Buffer.from(staticPage("page-home", `<a href="/other">Other</a>`)),
        }),
        [about]: fetchResponse(about, {
          body: Buffer.from(staticPage("page-about")),
        }),
        [other]: fetchResponse(other, {
          body: Buffer.from(staticPage("page-other", `<a href="/about">About</a>`)),
        }),
      },
      async (store) => {
        const result = await crawlWebflow({
          origin: ORIGIN,
          seedUrls: [
            { url: home, source: "crawl" },
            { url: about, source: "sitemap" },
          ],
          store,
          maxPages: 100,
          logger: silentLogger(),
        });

        const aboutRecords = result.pages.filter((page) => page.route === "/about");
        expect(aboutRecords).toHaveLength(2);
        expect(aboutRecords.map((record) => record.source).sort()).toEqual(["crawl", "sitemap"]);
      },
    );
  });

  it("resolves relative anchors and pagination against the redirect target (finalUrl), not the requested URL", async () => {
    const requested = `${ORIGIN}/a/old-blog`;
    const finalUrl = `${ORIGIN}/new-blog`;
    const wrongNext = `${ORIGIN}/a/next-page`;
    const correctNext = `${ORIGIN}/next-page`;
    const wrongPage2 = `${ORIGIN}/a/old-blog?items_page=2`;
    const correctPage2 = `${ORIGIN}/new-blog?items_page=2`;

    const paginationWrapper = `
      <div class="w-dyn-list">
        <div role="list" class="w-dyn-items"><div role="listitem" class="w-dyn-item">Item</div></div>
        <div role="navigation" aria-label="List" class="w-pagination-wrapper">
          <a href="?items_page=2" class="w-pagination-next">Next</a>
          <div class="w-page-count">1 / 2</div>
        </div>
      </div>
    `;

    await withStore(
      {
        [requested]: fetchResponse(requested, {
          finalUrl,
          redirectChain: [requested],
          body: Buffer.from(staticPage("page-blog", `<a href="next-page">Next</a>${paginationWrapper}`)),
        }),
        [correctNext]: fetchResponse(correctNext, {
          body: Buffer.from(staticPage("page-next")),
        }),
        [correctPage2]: fetchResponse(correctPage2, {
          body: Buffer.from(staticPage("page-blog-2")),
        }),
      },
      async (store, client) => {
        await crawlWebflow({
          origin: ORIGIN,
          seedUrls: [{ url: requested, source: "crawl" }],
          store,
          maxPages: 100,
          logger: silentLogger(),
        });

        expect(client.calls).toContain(correctNext);
        expect(client.calls).toContain(correctPage2);
        expect(client.calls).not.toContain(wrongNext);
        expect(client.calls).not.toContain(wrongPage2);
      },
    );
  });

  it("records a warning and continues past a network error without aborting the crawl", async () => {
    const home = `${ORIGIN}/`;
    const bad = `${ORIGIN}/bad`;
    const works = `${ORIGIN}/works`;

    await withStore(
      {
        [home]: fetchResponse(home, {
          body: Buffer.from(staticPage("page-home", `<a href="/bad">Bad</a><a href="/works">Works</a>`)),
        }),
        [works]: fetchResponse(works, {
          body: Buffer.from(staticPage("page-works")),
        }),
      },
      async (store) => {
        const result = await crawlWebflow({
          origin: ORIGIN,
          seedUrls: [{ url: home, source: "crawl" }],
          store,
          maxPages: 100,
          logger: silentLogger(),
        });

        expect(result.pages.some((page) => page.route === "/")).toBe(true);
        expect(result.pages.some((page) => page.route === "/works")).toBe(true);
        expect(result.warnings.some((warning) => warning.startsWith(`fetch error: ${bad}`))).toBe(true);
      },
    );
  });

  it("records a warning and emits no record for a >=400 response", async () => {
    const home = `${ORIGIN}/`;
    const missing = `${ORIGIN}/missing`;

    await withStore(
      {
        [home]: fetchResponse(home, {
          body: Buffer.from(staticPage("page-home", `<a href="/missing">Missing</a>`)),
        }),
        [missing]: fetchResponse(missing, { status: 404 }),
      },
      async (store) => {
        const result = await crawlWebflow({
          origin: ORIGIN,
          seedUrls: [{ url: home, source: "crawl" }],
          store,
          maxPages: 100,
          logger: silentLogger(),
        });

        expect(result.pages).toHaveLength(1);
        expect(result.warnings).toEqual([`fetch failed: ${missing} (status 404)`]);
      },
    );
  });
});

describe("crawlWebflow without a route gate", () => {
  it("crawls every internal link when no route gate exists", async () => {
    const home = `${ORIGIN}/`;
    const about = `${ORIGIN}/about`;
    const styleGuide = `${ORIGIN}/admin/style-guide`;

    await withStore(
      {
        [home]: fetchResponse(home, {
          body: Buffer.from(
            staticPage("page-home", `<a href="/about">a</a><a href="/admin/style-guide">b</a>`),
          ),
        }),
        [about]: fetchResponse(about, { body: Buffer.from(staticPage("page-about")) }),
        [styleGuide]: fetchResponse(styleGuide, { body: Buffer.from(staticPage("page-style-guide")) }),
      },
      async (store) => {
        const result = await crawlWebflow({
          origin: ORIGIN,
          seedUrls: [{ url: home, source: "crawl" }],
          store,
          maxPages: 50,
          logger: silentLogger(),
        });

        expect(result.pages.map((page) => page.route).sort()).toEqual(["/", "/about", "/admin/style-guide"]);
      },
    );
  });
});
