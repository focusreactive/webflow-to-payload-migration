import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SnapshotEntry } from "#lib/snapshot-store/types.ts";

import { listSnapshotFixtures, loadSnapshotFixture } from "../../../fixtures/snapshots/load.ts";

function makeEntry(overrides: Partial<SnapshotEntry> = {}): SnapshotEntry {
  return {
    url: "https://example.com/",
    kind: "probe",
    paths: { raw: join("probe", "home.html") },
    http: {
      status: 200,
      finalUrl: "https://example.com/",
      redirectChain: [],
    },
    sha256: "a".repeat(64),
    size: 0,
    fetchedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("loadSnapshotFixture", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "snapshot-fixture-loader-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads index.json and the raw body it points at", async () => {
    const rawContent = "<html><body>hello</body></html>";
    const entry = makeEntry({ size: rawContent.length });

    await mkdir(join(dir, "probe"), { recursive: true });
    await writeFile(join(dir, entry.paths.raw), rawContent, "utf8");
    await writeFile(join(dir, "index.json"), JSON.stringify({ schemaVersion: 2, entries: { [entry.url]: entry } }));

    const fixture = await loadSnapshotFixture(dir);

    expect(fixture.dir).toBe(dir);
    expect(fixture.index).toEqual({
      schemaVersion: 2,
      entries: { [entry.url]: entry },
    });

    const body = await fixture.readBody(entry.paths.raw);
    expect(body.toString("utf8")).toBe(rawContent);
  });

  it("throws when index.json is missing", async () => {
    await expect(loadSnapshotFixture(dir)).rejects.toThrow(/index\.json/);
  });
});

describe("listSnapshotFixtures", () => {
  const FIXTURES_ROOT = join(import.meta.dirname, "..", "..", "..", "fixtures", "snapshots");
  // Isolated platform name so this suite never collides with real,
  // hand-collected fixtures added later under webflow.
  const TEST_PLATFORM = "__fixture-loader-test__";
  const TEST_PLATFORM_DIR = join(FIXTURES_ROOT, TEST_PLATFORM);

  afterEach(async () => {
    await rm(TEST_PLATFORM_DIR, { recursive: true, force: true });
  });

  it("discovers fixture dirs by index.json, sorted by platform then name", async () => {
    const entry = makeEntry();

    await mkdir(join(TEST_PLATFORM_DIR, "zzz-name"), { recursive: true });
    await writeFile(
      join(TEST_PLATFORM_DIR, "zzz-name", "index.json"),
      JSON.stringify({ schemaVersion: 2, entries: { [entry.url]: entry } }),
    );

    await mkdir(join(TEST_PLATFORM_DIR, "aaa-name"), { recursive: true });
    await writeFile(
      join(TEST_PLATFORM_DIR, "aaa-name", "index.json"),
      JSON.stringify({ schemaVersion: 2, entries: {} }),
    );

    // Not a fixture: no index.json.
    await mkdir(join(TEST_PLATFORM_DIR, "not-a-fixture"), { recursive: true });

    const all = await listSnapshotFixtures();
    const ours = all.filter((fixture) => fixture.platform === TEST_PLATFORM);

    expect(ours).toEqual([
      {
        platform: TEST_PLATFORM,
        name: "aaa-name",
        dir: join(TEST_PLATFORM_DIR, "aaa-name"),
      },
      {
        platform: TEST_PLATFORM,
        name: "zzz-name",
        dir: join(TEST_PLATFORM_DIR, "zzz-name"),
      },
    ]);
  });
});
