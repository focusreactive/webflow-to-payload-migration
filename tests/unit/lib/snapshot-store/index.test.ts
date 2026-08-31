import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FetchClient, FetchResponse } from "#lib/fetch/create-fetch-client/index.ts";
import { writeFileAtomic } from "#lib/fs.ts";
import { openSnapshotStore, renderedByRoute } from "#lib/snapshot-store/index.ts";
import { SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";
import { snapshotIndexSchema } from "#lib/snapshot-store/schema.ts";

function fetchResponse(url: string, overrides: Partial<FetchResponse> = {}): FetchResponse {
  return {
    status: 200,
    finalUrl: url,
    redirectChain: [],
    headers: { "content-type": "text/html" },
    body: Buffer.from(`body for ${url}`),
    ...overrides,
  };
}

/** Fake FetchClient: resolves each URL against a lookup table and records
 * every call so tests can assert the network was (or wasn't) touched. */
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

describe("snapshot store", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "snapshot-store-test-"));
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  describe("openSnapshotStore", () => {
    it("starts with an empty registry when no index.json exists", async () => {
      const client = createFakeFetchClient({});
      const store = await openSnapshotStore(projectPath, client);

      expect(store.entries()).toEqual([]);
      expect(store.has("https://example.com/")).toBe(false);
    });
  });

  describe("fetchInto", () => {
    it("writes the body to the mirrored path and records a valid entry", async () => {
      const url = "https://example.com/about";
      const client = createFakeFetchClient({
        [url]: fetchResponse(url, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            etag: '"abc123"',
            "last-modified": "Wed, 01 Jan 2025 00:00:00 GMT",
          },
        }),
      });
      const store = await openSnapshotStore(projectPath, client);

      const entry = await store.fetchInto(url, "page");

      const expectedBody = Buffer.from(`body for ${url}`);
      expect(entry.url).toBe("https://example.com/about");
      expect(entry.kind).toBe("page");
      expect(entry.paths.raw).toBe(join("pages", "about", "index.html"));
      expect(entry.sha256).toBe(createHash("sha256").update(expectedBody).digest("hex"));
      expect(entry.size).toBe(expectedBody.length);
      expect(entry.http).toEqual({
        status: 200,
        finalUrl: url,
        redirectChain: [],
        contentType: "text/html; charset=utf-8",
        etag: '"abc123"',
        lastModified: "Wed, 01 Jan 2025 00:00:00 GMT",
      });
      expect(entry.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      const written = await readFile(join(projectPath, SNAPSHOT_DIR, entry.paths.raw));
      expect(written).toEqual(expectedBody);
    });

    it("omits optional http metadata fields the response did not send", async () => {
      const url = "https://example.com/bare";
      const client = createFakeFetchClient({
        [url]: fetchResponse(url, { headers: {} }),
      });
      const store = await openSnapshotStore(projectPath, client);

      const entry = await store.fetchInto(url, "page");

      expect(entry.http).toEqual({
        status: 200,
        finalUrl: url,
        redirectChain: [],
      });
      expect(entry.http).not.toHaveProperty("contentType");
    });

    it("is idempotent per normalized URL and never re-fetches", async () => {
      const url = "https://example.com/about";
      const client = createFakeFetchClient({ [url]: fetchResponse(url) });
      const store = await openSnapshotStore(projectPath, client);

      const first = await store.fetchInto(url, "page");
      const second = await store.fetchInto("HTTPS://EXAMPLE.com/about/", "page");

      expect(second).toEqual(first);
      expect(client.calls).toEqual([url]);
    });

    it("has/get resolve non-normalized URL forms to the same entry", async () => {
      const url = "https://example.com/about";
      const client = createFakeFetchClient({ [url]: fetchResponse(url) });
      const store = await openSnapshotStore(projectPath, client);
      await store.fetchInto(url, "page");

      expect(store.has("HTTPS://EXAMPLE.com/about/")).toBe(true);
      expect(store.get("HTTPS://EXAMPLE.com/about/")).toEqual(store.get(url));
    });

    it("places the file at an explicit relativePath, bypassing mirrorPath", async () => {
      const url = "https://example.com/__probe__";
      const client = createFakeFetchClient({ [url]: fetchResponse(url) });
      const store = await openSnapshotStore(projectPath, client);

      const entry = await store.fetchInto(url, "probe", {
        relativePath: join("probes", "root.html"),
      });

      expect(entry.paths.raw).toBe(join("probes", "root.html"));
      const written = await readFile(join(projectPath, SNAPSHOT_DIR, "probes", "root.html"));
      expect(written).toEqual(Buffer.from(`body for ${url}`));
    });

    it("throws when kind is probe without an explicit relativePath", async () => {
      const url = "https://example.com/__probe__";
      const client = createFakeFetchClient({ [url]: fetchResponse(url) });
      const store = await openSnapshotStore(projectPath, client);

      await expect(store.fetchInto(url, "probe")).rejects.toThrow(/kind 'probe' requires opts\.relativePath/);
      expect(client.calls).toEqual([]);
    });

    it("promotes a provisional probe entry to the definitive kind on a later fetch, without re-fetching", async () => {
      // The probe stage registers a few URLs (home, robots, sitemap, 404)
      // before their real role is known. When the snapshot stage later fetches
      // one of those URLs with a definitive kind (the home page as "page"), the
      // entry must be promoted so consumers keyed off `kind` (renderedByRoute,
      // layout/schema plans) recognize it as that kind.
      const url = "https://example.com/";
      const client = createFakeFetchClient({ [url]: fetchResponse(url) });
      const store = await openSnapshotStore(projectPath, client);

      const probeEntry = await store.fetchInto(url, "probe", {
        relativePath: join("probe", "home.html"),
      });
      expect(probeEntry.kind).toBe("probe");

      const pageEntry = await store.fetchInto(url, "page");

      expect(pageEntry.kind).toBe("page");
      expect(pageEntry.paths.raw).toBe(probeEntry.paths.raw);
      expect(store.get(url)?.kind).toBe("page");
      // Promotion reuses the cached body: no second network call.
      expect(client.calls).toEqual([url]);

      // The promotion is persisted to index.json.
      const reopened = await openSnapshotStore(projectPath, createFakeFetchClient({}));
      expect(reopened.get(url)?.kind).toBe("page");
    });

    it("preserves attached rendered/styles paths when promoting a probe entry", async () => {
      const url = "https://example.com/";
      const client = createFakeFetchClient({ [url]: fetchResponse(url) });
      const store = await openSnapshotStore(projectPath, client);

      await store.fetchInto(url, "probe", { relativePath: join("probe", "home.html") });
      await store.attachDerived(url, {
        rendered: join("probe", "index.rendered.html"),
        styles: join("probe", "index.styles.json"),
      });

      const promoted = await store.fetchInto(url, "page");

      expect(promoted.kind).toBe("page");
      expect(promoted.paths).toEqual({
        raw: join("probe", "home.html"),
        rendered: join("probe", "index.rendered.html"),
        styles: join("probe", "index.styles.json"),
      });
    });

    it("does not change a definitive entry's kind on a later mismatched fetch (plain dedup)", async () => {
      const url = "https://example.com/style.css";
      const client = createFakeFetchClient({ [url]: fetchResponse(url) });
      const store = await openSnapshotStore(projectPath, client);

      const first = await store.fetchInto(url, "style");
      const second = await store.fetchInto(url, "asset");

      expect(first.kind).toBe("style");
      expect(second.kind).toBe("style");
      expect(client.calls).toEqual([url]);
    });

    it("records a 404 response in the registry and still writes the body file", async () => {
      const url = "https://example.com/missing";
      const client = createFakeFetchClient({
        [url]: fetchResponse(url, {
          status: 404,
          body: Buffer.from("not found"),
        }),
      });
      const store = await openSnapshotStore(projectPath, client);

      const entry = await store.fetchInto(url, "page");

      expect(entry.http.status).toBe(404);
      const written = await readFile(join(projectPath, SNAPSHOT_DIR, entry.paths.raw));
      expect(written).toEqual(Buffer.from("not found"));
    });

    it("resolves a filename collision between two assets to distinct paths", async () => {
      const urlA = "https://cdn1.example.com/img/photo.jpg";
      const urlB = "https://cdn2.example.com/img/photo.jpg";
      const client = createFakeFetchClient({
        [urlA]: fetchResponse(urlA, { body: Buffer.from("image A") }),
        [urlB]: fetchResponse(urlB, { body: Buffer.from("image B") }),
      });
      const store = await openSnapshotStore(projectPath, client);

      const entryA = await store.fetchInto(urlA, "asset");
      const entryB = await store.fetchInto(urlB, "asset");

      expect(entryA.paths.raw).toBe(join("assets", "media", "photo.jpg"));
      expect(entryB.paths.raw).toMatch(/^assets[/\\]media[/\\]photo-[0-9a-f]{8}\.jpg$/);
      expect(entryA.paths.raw).not.toBe(entryB.paths.raw);

      const bodyA = await readFile(join(projectPath, SNAPSHOT_DIR, entryA.paths.raw));
      const bodyB = await readFile(join(projectPath, SNAPSHOT_DIR, entryB.paths.raw));
      expect(bodyA).toEqual(Buffer.from("image A"));
      expect(bodyB).toEqual(Buffer.from("image B"));
    });

    it("reserves the resolved path synchronously so concurrent fetches for different URLs sharing a basename never collide", async () => {
      const urlA = "https://cdn1.example.com/img/photo.jpg";
      const urlB = "https://cdn2.example.com/img/photo.jpg";
      const client = createFakeFetchClient({
        [urlA]: fetchResponse(urlA, { body: Buffer.from("image A") }),
        [urlB]: fetchResponse(urlB, { body: Buffer.from("image B") }),
      });
      const store = await openSnapshotStore(projectPath, client);

      // Both calls start before either has landed in the registry: without
      // a synchronous path reservation, both would resolve mirrorPath
      // against the same pre-fetch state and collide on the same raw path.
      const [entryA, entryB] = await Promise.all([store.fetchInto(urlA, "asset"), store.fetchInto(urlB, "asset")]);

      expect(entryA.paths.raw).not.toBe(entryB.paths.raw);

      const bodyA = await readFile(join(projectPath, SNAPSHOT_DIR, entryA.paths.raw));
      const bodyB = await readFile(join(projectPath, SNAPSHOT_DIR, entryB.paths.raw));
      expect(bodyA).toEqual(Buffer.from("image A"));
      expect(bodyB).toEqual(Buffer.from("image B"));
    });

    it("writes a schema-valid index.json after each fetch", async () => {
      const url = "https://example.com/about";
      const client = createFakeFetchClient({ [url]: fetchResponse(url) });
      const store = await openSnapshotStore(projectPath, client);
      await store.fetchInto(url, "page");

      const raw: unknown = JSON.parse(await readFile(join(projectPath, SNAPSHOT_DIR, "index.json"), "utf8"));
      const parsed = snapshotIndexSchema.parse(raw);

      expect(parsed.schemaVersion).toBe(2);
      expect(Object.keys(parsed.entries)).toEqual(["https://example.com/about"]);
    });

    it("does not leave a registry entry when persisting index.json fails after a successful fetch", async () => {
      const url = "https://example.com/about";
      const client = createFakeFetchClient({ [url]: fetchResponse(url) });
      const store = await openSnapshotStore(projectPath, client);

      // Force the writeFileAtomic rename inside persistIndex to fail: a
      // directory sitting at the destination path makes rename() reject,
      // same technique tests/unit/lib/fs.test.ts uses for writeFileAtomic
      // itself, without mocking '#lib/fs.ts'.
      await mkdir(join(projectPath, SNAPSHOT_DIR, "index.json"), {
        recursive: true,
      });

      await expect(store.fetchInto(url, "page")).rejects.toThrow();

      expect(store.has(url)).toBe(false);
      expect(store.get(url)).toBeUndefined();
      expect(store.entries()).toEqual([]);
    });

    it("persists every entry from N concurrent fetches, never losing one to a write race", async () => {
      // 20 concurrent calls with a 0-3ms fetch jitter was tuned empirically
      // (scripted trials against the pre-fix store) to make every persisted
      // fetchInto's persistIndex write genuinely interleave with the
      // others: it makes the unserialized store lose at least one entry on
      // ~94% of runs, vs. ~90% with no jitter at all and a much lower rate
      // at wider jitter (which spreads writes out enough to let most of
      // them serialize by luck instead of racing).
      const count = 20;
      const urls = Array.from({ length: count }, (_, i) => `https://example.com/item-${i}`);
      const responses: Record<string, FetchResponse> = {};
      for (const url of urls) {
        responses[url] = fetchResponse(url, { body: Buffer.from(url) });
      }
      const baseClient = createFakeFetchClient(responses);

      const client: FetchClient & { calls: string[] } = {
        calls: baseClient.calls,
        async fetch(url: string): Promise<FetchResponse> {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 3));
          return baseClient.fetch(url);
        },
        setCrawlDelayMs(): void {},
      };

      const store = await openSnapshotStore(projectPath, client);

      await Promise.all(urls.map((url) => store.fetchInto(url, "page")));

      const raw: unknown = JSON.parse(await readFile(join(projectPath, SNAPSHOT_DIR, "index.json"), "utf8"));
      const parsed = snapshotIndexSchema.parse(raw);

      expect(Object.keys(parsed.entries).sort()).toEqual(
        store
          .entries()
          .map((entry) => entry.url)
          .sort(),
      );
      expect(Object.keys(parsed.entries)).toHaveLength(count);
    });
  });

  describe("readBody", () => {
    it("returns the exact bytes written for the entry", async () => {
      const url = "https://example.com/about";
      const body = Buffer.from("exact bytes here");
      const client = createFakeFetchClient({
        [url]: fetchResponse(url, { body }),
      });
      const store = await openSnapshotStore(projectPath, client);
      const entry = await store.fetchInto(url, "page");

      await expect(store.readBody(entry)).resolves.toEqual(body);
    });
  });

  describe("reopening a store", () => {
    it("round-trips the registry through index.json on disk", async () => {
      const url = "https://example.com/about";
      const body = Buffer.from("persisted body");
      const client = createFakeFetchClient({
        [url]: fetchResponse(url, { body }),
      });

      const storeA = await openSnapshotStore(projectPath, client);
      const written = await storeA.fetchInto(url, "page");

      const clientB = createFakeFetchClient({});
      const storeB = await openSnapshotStore(projectPath, clientB);

      expect(storeB.has(url)).toBe(true);
      expect(storeB.get(url)).toEqual(written);
      expect(storeB.entries()).toEqual([written]);
      await expect(storeB.readBody(written)).resolves.toEqual(body);
      expect(clientB.calls).toEqual([]);
    });
  });

  describe("attachDerived", () => {
    it("merges rendered/styles into an existing entry and persists them", async () => {
      const url = "https://example.com/about";
      const client = createFakeFetchClient({ [url]: fetchResponse(url) });
      const store = await openSnapshotStore(projectPath, client);
      await store.fetchInto(url, "page");

      const updated = await store.attachDerived(url, {
        rendered: join("pages", "about", "index.rendered.html"),
        styles: join("pages", "about", "index.styles.json"),
      });

      expect(updated.paths).toEqual({
        raw: join("pages", "about", "index.html"),
        rendered: join("pages", "about", "index.rendered.html"),
        styles: join("pages", "about", "index.styles.json"),
      });
      expect(store.get(url)).toEqual(updated);

      const reopened = await openSnapshotStore(projectPath, createFakeFetchClient({}));
      expect(reopened.get(url)).toEqual(updated);
    });

    it("throws when the url has no existing snapshot entry", async () => {
      const store = await openSnapshotStore(projectPath, createFakeFetchClient({}));

      await expect(
        store.attachDerived("https://example.com/missing", {
          rendered: join("pages", "missing", "index.rendered.html"),
        }),
      ).rejects.toThrow(/https:\/\/example\.com\/missing/);
    });
  });

  describe("clearExceptProbe", () => {
    it("keeps probe entries and files, and removes page entries and content dirs", async () => {
      const pageUrl = "https://example.com/about";
      const probeUrl = "https://example.com/__probe__";
      const client = createFakeFetchClient({
        [pageUrl]: fetchResponse(pageUrl),
        [probeUrl]: fetchResponse(probeUrl),
      });
      const store = await openSnapshotStore(projectPath, client);
      await store.fetchInto(pageUrl, "page");
      const probeEntry = await store.fetchInto(probeUrl, "probe", {
        relativePath: join("probe", "root.html"),
      });

      await store.clearExceptProbe();

      expect(store.has(pageUrl)).toBe(false);
      expect(store.has(probeUrl)).toBe(true);
      expect(store.entries()).toEqual([probeEntry]);
      expect(existsSync(join(projectPath, SNAPSHOT_DIR, "pages"))).toBe(false);
      expect(existsSync(join(projectPath, SNAPSHOT_DIR, "probe", "root.html"))).toBe(true);

      const reopened = await openSnapshotStore(projectPath, createFakeFetchClient({}));
      expect(reopened.entries()).toEqual([probeEntry]);
    });

    it("demotes probe entries promoted to page back to probe instead of deleting them", async () => {
      const homeUrl = "https://example.com/";
      const client = createFakeFetchClient({ [homeUrl]: fetchResponse(homeUrl) });
      const store = await openSnapshotStore(projectPath, client);
      await store.fetchInto(homeUrl, "probe", {
        relativePath: join("probe", "home.html"),
      });
      await store.fetchInto(homeUrl, "page");
      await store.attachDerived(homeUrl, {
        rendered: join("probe", "home.rendered.html"),
        styles: join("probe", "home.styles.json"),
      });

      await store.clearExceptProbe();

      expect(store.has(homeUrl)).toBe(true);
      const [entry] = store.entries();
      expect(entry?.kind).toBe("probe");
      expect(entry?.paths).toEqual({ raw: join("probe", "home.html") });
      expect(existsSync(join(projectPath, SNAPSHOT_DIR, "probe", "home.html"))).toBe(true);
    });

    it("removes all known content dirs even when only some exist", async () => {
      const pageUrl = "https://example.com/about";
      const client = createFakeFetchClient({
        [pageUrl]: fetchResponse(pageUrl),
      });
      const store = await openSnapshotStore(projectPath, client);
      await store.fetchInto(pageUrl, "page");

      await mkdir(join(projectPath, SNAPSHOT_DIR, "styles"), {
        recursive: true,
      });
      await writeFile(join(projectPath, SNAPSHOT_DIR, "styles", "site.css"), "body {}");

      await store.clearExceptProbe();

      for (const dir of ["pages", "styles", "scripts", "data", "assets"]) {
        expect(existsSync(join(projectPath, SNAPSHOT_DIR, dir))).toBe(false);
      }
    });
  });

  describe("renderedByRoute", () => {
    it("maps each page route to its rendered path, skipping entries without one", async () => {
      const pageUrl = "https://example.com/about";
      const bareUrl = "https://example.com/contact";
      const styleUrl = "https://example.com/site.css";
      const client = createFakeFetchClient({
        [pageUrl]: fetchResponse(pageUrl),
        [bareUrl]: fetchResponse(bareUrl),
        [styleUrl]: fetchResponse(styleUrl),
      });
      const store = await openSnapshotStore(projectPath, client);

      await store.fetchInto(pageUrl, "page");
      await store.attachDerived(pageUrl, { rendered: join("pages", "about", "index.rendered.html") });
      await store.fetchInto(bareUrl, "page");
      await store.fetchInto(styleUrl, "style");
      await store.attachDerived(styleUrl, { rendered: join("styles", "site.rendered.html") });

      const map = renderedByRoute(store);

      expect(map.get("/about")).toBe(join("pages", "about", "index.rendered.html"));
      expect(map.has("/contact")).toBe(false);
      expect(map.has("/site.css")).toBe(false);
      expect(map.size).toBe(1);
    });
  });

  describe("index schema version", () => {
    it("fails loudly when opening a store with an outdated index", async () => {
      await writeFileAtomic(
        join(projectPath, SNAPSHOT_DIR, "index.json"),
        `${JSON.stringify({ schemaVersion: 1, entries: {} })}\n`,
      );

      await expect(openSnapshotStore(projectPath, createFakeFetchClient({}))).rejects.toThrow(
        /schemaVersion 1.*expects 2/s,
      );
    });
  });
});
