import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { listDetectionFixtures, loadDetectionFixture } from "../../../fixtures/detection/load.ts";

const FIXTURES_ROOT = join(import.meta.dirname, "..", "..", "..", "fixtures", "detection");

// Isolated group name so this suite never collides with real, hand-authored
// fixtures added later under webflow/negative.
const TEST_GROUP = "__fixture-loader-test__";
const TEST_GROUP_DIR = join(FIXTURES_ROOT, TEST_GROUP);

async function writeText(dir: string, fileName: string, content: string) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, fileName), content, "utf8");
}

describe("loadDetectionFixture", () => {
  afterEach(async () => {
    await rm(TEST_GROUP_DIR, { recursive: true, force: true });
  });

  it("round-trips required fields and populates present optionals", async () => {
    const dir = join(TEST_GROUP_DIR, "full");
    await writeText(
      dir,
      "meta.json",
      JSON.stringify({
        sourceUrl: "https://example.com/",
        collectedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    await writeText(dir, "home.html", "<html>home</html>");
    await writeText(
      dir,
      "home-http.json",
      JSON.stringify({
        status: 200,
        finalUrl: "https://example.com/",
        redirectChain: [],
        headers: { "content-type": "text/html" },
      }),
    );
    await writeText(dir, "robots.txt", "User-agent: *\n");
    await writeText(dir, "sitemap.xml", "<urlset></urlset>");
    await writeText(dir, "not-found.html", "<html>404</html>");
    await writeText(
      dir,
      "not-found-http.json",
      JSON.stringify({
        status: 404,
        finalUrl: "https://example.com/__migration-probe-404__",
        redirectChain: [],
        headers: {},
      }),
    );

    const data = await loadDetectionFixture(dir);

    expect(data).toEqual({
      sourceUrl: "https://example.com/",
      homeHtml: "<html>home</html>",
      homeHttp: {
        status: 200,
        finalUrl: "https://example.com/",
        redirectChain: [],
        headers: { "content-type": "text/html" },
      },
      robotsTxt: "User-agent: *\n",
      sitemapXml: "<urlset></urlset>",
      notFound: { html: "<html>404</html>", status: 404 },
    });
  });

  it("omits absent optional fields entirely (not just undefined)", async () => {
    const dir = join(TEST_GROUP_DIR, "minimal");
    await writeText(
      dir,
      "meta.json",
      JSON.stringify({
        sourceUrl: "https://minimal.example.com/",
        collectedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    await writeText(dir, "home.html", "<html>minimal</html>");
    await writeText(
      dir,
      "home-http.json",
      JSON.stringify({
        status: 200,
        finalUrl: "https://minimal.example.com/",
        redirectChain: [],
        headers: {},
      }),
    );

    const data = await loadDetectionFixture(dir);

    expect(data.sourceUrl).toBe("https://minimal.example.com/");
    expect(data.homeHtml).toBe("<html>minimal</html>");
    expect("robotsTxt" in data).toBe(false);
    expect("sitemapXml" in data).toBe(false);
    expect("notFound" in data).toBe(false);
  });

  it("throws a clear error naming the dir when a required file is missing", async () => {
    const dir = join(TEST_GROUP_DIR, "broken");
    await writeText(
      dir,
      "meta.json",
      JSON.stringify({
        sourceUrl: "https://broken.example.com/",
        collectedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    // home.html and home-http.json deliberately omitted.

    await expect(loadDetectionFixture(dir)).rejects.toThrow(/home\.html/);
    await expect(loadDetectionFixture(dir)).rejects.toThrow(new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});

describe("listDetectionFixtures", () => {
  afterEach(async () => {
    await rm(TEST_GROUP_DIR, { recursive: true, force: true });
  });

  it("discovers fixture dirs across groups, sorted by group then name, excluding non-fixture dirs", async () => {
    // Fixture dirs are identified by meta.json OR expected.json — neither
    // needs to be a full, loadable fixture for discovery purposes.
    await writeText(
      join(TEST_GROUP_DIR, "zzz-name"),
      "meta.json",
      JSON.stringify({ sourceUrl: "https://z.example.com/" }),
    );
    await writeText(join(TEST_GROUP_DIR, "aaa-name"), "expected.json", JSON.stringify({ verdict: "webflow" }));
    // Not a fixture: no meta.json and no expected.json.
    await mkdir(join(TEST_GROUP_DIR, "not-a-fixture"), { recursive: true });
    await writeText(join(TEST_GROUP_DIR, "not-a-fixture"), "random.txt", "nothing to see here");

    const all = await listDetectionFixtures();
    const ours = all.filter((entry) => entry.group === TEST_GROUP);

    expect(ours).toEqual([
      {
        group: TEST_GROUP,
        name: "aaa-name",
        dir: join(TEST_GROUP_DIR, "aaa-name"),
      },
      {
        group: TEST_GROUP,
        name: "zzz-name",
        dir: join(TEST_GROUP_DIR, "zzz-name"),
      },
    ]);
  });
});
