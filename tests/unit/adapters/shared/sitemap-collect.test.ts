import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { collectSitemapUrls } from "#adapters/shared/sitemap-collect.ts";
import type { FetchClient, FetchResponse } from "#lib/fetch/create-fetch-client/index.ts";
import type { Logger } from "#lib/logger.ts";
import { openSnapshotStore } from "#lib/snapshot-store/index.ts";
import type { SnapshotStore } from "#lib/snapshot-store/types.ts";

const ORIGIN = "https://example.com";

function fetchResponse(url: string, overrides: Partial<FetchResponse> = {}): FetchResponse {
  return {
    status: 200,
    finalUrl: url,
    redirectChain: [],
    headers: { "content-type": "application/xml" },
    body: Buffer.from(""),
    ...overrides,
  };
}

function createFakeFetchClient(responses: Record<string, FetchResponse>): FetchClient {
  return {
    fetch(url: string): Promise<FetchResponse> {
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

function urlset(locs: string[]): string {
  const urls = locs.map((loc) => `<url><loc>${loc}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

function sitemapindex(locs: string[]): string {
  const sitemaps = locs.map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemaps}</sitemapindex>`;
}

async function withStore(
  responses: Record<string, FetchResponse>,
  run: (store: SnapshotStore) => Promise<void>,
): Promise<void> {
  const projectPath = await mkdtemp(join(tmpdir(), "sitemap-collect-test-"));
  try {
    const client = createFakeFetchClient(responses);
    const store = await openSnapshotStore(projectPath, client);
    await run(store);
  } finally {
    await rm(projectPath, { recursive: true, force: true });
  }
}

describe("collectSitemapUrls", () => {
  it("returns the locs of a urlset root", async () => {
    const rootSitemapXml = urlset([`${ORIGIN}/a`, `${ORIGIN}/b`]);

    await withStore({}, async (store) => {
      const urls = await collectSitemapUrls({
        rootSitemapXml,
        store,
        logger: silentLogger(),
      });

      expect(urls).toEqual([`${ORIGIN}/a`, `${ORIGIN}/b`]);
    });
  });

  it("recurses into a sitemapindex and unions the children locs, deduping and preserving first-seen order", async () => {
    const child1 = `${ORIGIN}/sitemap-1.xml`;
    const child2 = `${ORIGIN}/sitemap-2.xml`;
    const rootSitemapXml = sitemapindex([child1, child2]);

    await withStore(
      {
        [child1]: fetchResponse(child1, {
          body: Buffer.from(urlset([`${ORIGIN}/a`, `${ORIGIN}/b`])),
        }),
        [child2]: fetchResponse(child2, {
          body: Buffer.from(urlset([`${ORIGIN}/b`, `${ORIGIN}/c`])),
        }),
      },
      async (store) => {
        const urls = await collectSitemapUrls({
          rootSitemapXml,
          store,
          logger: silentLogger(),
        });

        expect(urls).toEqual([`${ORIGIN}/a`, `${ORIGIN}/b`, `${ORIGIN}/c`]);
      },
    );
  });

  it("returns [] for an undefined root", async () => {
    await withStore({}, async (store) => {
      const urls = await collectSitemapUrls({
        rootSitemapXml: undefined,
        store,
        logger: silentLogger(),
      });

      expect(urls).toEqual([]);
    });
  });

  it("returns [] for an unrecognized root document", async () => {
    await withStore({}, async (store) => {
      const urls = await collectSitemapUrls({
        rootSitemapXml: '<?xml version="1.0"?><something-else/>',
        store,
        logger: silentLogger(),
      });

      expect(urls).toEqual([]);
    });
  });

  it("warns and skips a child sitemap fetch that throws, still collecting the other child", async () => {
    const badChild = `${ORIGIN}/sitemap-bad.xml`;
    const goodChild = `${ORIGIN}/sitemap-good.xml`;
    const rootSitemapXml = sitemapindex([badChild, goodChild]);

    const warnings: string[] = [];
    const logger: Logger = {
      debug: () => undefined,
      info: () => undefined,
      warn: (msg) => warnings.push(msg),
      error: () => undefined,
    };

    await withStore(
      {
        [goodChild]: fetchResponse(goodChild, {
          body: Buffer.from(urlset([`${ORIGIN}/x`])),
        }),
      },
      async (store) => {
        const urls = await collectSitemapUrls({
          rootSitemapXml,
          store,
          logger,
        });

        expect(urls).toEqual([`${ORIGIN}/x`]);
        expect(warnings.length).toBeGreaterThan(0);
      },
    );
  });
});
