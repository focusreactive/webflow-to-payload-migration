import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadInventoryFixture } from "../../../fixtures/inventory/load.ts";

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(value));
}

describe("loadInventoryFixture", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "inventory-fixture-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("serves recorded pages by normalized URL and 404s unknown URLs", async () => {
    await writeFile(join(dir, "sourceUrl.txt"), "https://example.com/\n");
    await mkdir(join(dir, "pages"), { recursive: true });
    await writeJsonFile(join(dir, "pages", "0.json"), {
      url: "https://example.com/",
      status: 200,
      body: "<html>home</html>",
    });
    await writeJsonFile(join(dir, "pages", "1.json"), {
      url: "https://example.com/about",
      status: 200,
      body: "<html>about</html>",
    });

    const fixture = await loadInventoryFixture(dir);

    expect(fixture.sourceUrl).toBe("https://example.com/");
    expect(fixture.rootSitemapXml).toBeUndefined();

    const home = await fixture.fetchClient.fetch("https://example.com/");
    expect(home.status).toBe(200);
    expect(home.body.toString("utf8")).toBe("<html>home</html>");
    expect(home.redirectChain).toEqual([]);

    const missing = await fixture.fetchClient.fetch("https://example.com/missing");
    expect(missing.status).toBe(404);
    expect(missing.body.length).toBe(0);
  });

  it("resolves a non-normalized form of a known URL to the same page", async () => {
    await writeFile(join(dir, "sourceUrl.txt"), "https://example.com/\n");
    await mkdir(join(dir, "pages"), { recursive: true });
    await writeJsonFile(join(dir, "pages", "0.json"), {
      url: "https://example.com/about",
      status: 200,
      body: "<html>about</html>",
    });

    const fixture = await loadInventoryFixture(dir);

    const response = await fixture.fetchClient.fetch("HTTPS://EXAMPLE.com/about/");

    expect(response.status).toBe(200);
    expect(response.body.toString("utf8")).toBe("<html>about</html>");
  });

  it("defaults a page missing an explicit status to 200", async () => {
    await writeFile(join(dir, "sourceUrl.txt"), "https://example.com/\n");
    await mkdir(join(dir, "pages"), { recursive: true });
    await writeJsonFile(join(dir, "pages", "0.json"), {
      url: "https://example.com/",
      body: "<html>home</html>",
    });

    const fixture = await loadInventoryFixture(dir);

    const response = await fixture.fetchClient.fetch("https://example.com/");
    expect(response.status).toBe(200);
  });

  it("exposes rootSitemapXml when sitemap.xml is present in the fixture", async () => {
    await writeFile(join(dir, "sourceUrl.txt"), "https://example.com/\n");
    await writeFile(join(dir, "sitemap.xml"), "<urlset></urlset>");

    const fixture = await loadInventoryFixture(dir);

    expect(fixture.rootSitemapXml).toBe("<urlset></urlset>");
  });

  it("throws a clear error when sourceUrl.txt is missing", async () => {
    await expect(loadInventoryFixture(dir)).rejects.toThrow(/missing required file: sourceUrl\.txt/);
  });
});
