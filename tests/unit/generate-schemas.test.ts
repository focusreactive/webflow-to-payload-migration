import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { generateSchemaFiles, writeSchemaFiles } from "../../src/generate-schemas/generate.ts";

const SCHEMAS_DIR = join(import.meta.dirname, "..", "..", "schemas");

describe("generateSchemaFiles", () => {
  it("always emits the config schema", () => {
    const files = generateSchemaFiles();

    expect(Object.keys(files)).toContain("migrate.config.schema.json");
  });

  it("emits committed files that are up to date (freshness)", async () => {
    for (const [relativePath, content] of Object.entries(generateSchemaFiles())) {
      await expect(
        readFile(join(SCHEMAS_DIR, relativePath), "utf8"),
        `${relativePath} is stale — run 'pnpm generate:schemas' and commit the result`,
      ).resolves.toBe(content);
    }
  });
});

describe("writeSchemaFiles", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "schemas-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("creates all schema files in an empty directory", async () => {
    await writeSchemaFiles(dir);

    const written = await readdir(dir, { recursive: true });
    expect(written).toContain("migrate.config.schema.json");
    for (const relativePath of Object.keys(generateSchemaFiles())) {
      const content = await readFile(join(dir, relativePath), "utf8");
      expect(content.endsWith("\n")).toBe(true);
      expect(JSON.parse(content)).toBeTypeOf("object");
    }
  });
});
