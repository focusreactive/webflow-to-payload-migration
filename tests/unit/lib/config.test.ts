import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadMigrateConfig, migrateConfigSchema } from "#lib/migrate-config/index.ts";

const FIXTURES_DIR = join(import.meta.dirname, "..", "..", "fixtures", "config");

async function readFixture(name: string): Promise<unknown> {
  return JSON.parse(await readFile(join(FIXTURES_DIR, name), "utf8"));
}

describe("migrateConfigSchema", () => {
  it("parses a valid config and fills defaults", async () => {
    const raw = await readFixture("valid.json");

    const config = migrateConfigSchema.parse(raw);

    expect(config.workspace).toEqual({ path: "../migrations" });
    expect(Object.keys(config)).toEqual(["workspace"]);
  });

  it("rejects unknown keys", async () => {
    const raw = await readFixture("unknown-key.json");

    expect(() => migrateConfigSchema.parse(raw)).toThrow(/unknownSection/);
  });
});

describe("loadMigrateConfig", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "config-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("loads and parses migrate.config.json from the tool root", async () => {
    await copyFile(join(FIXTURES_DIR, "valid.json"), join(dir, "migrate.config.json"));

    const config = loadMigrateConfig(dir);

    expect(config.workspace.path).toBe("../migrations");
  });

  it("throws an error naming the missing file when config is absent", () => {
    expect(() => loadMigrateConfig(dir)).toThrow(/migrate\.config\.json not found/);
  });
});
