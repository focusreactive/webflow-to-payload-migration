import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { migrateConfigSchema, type MigrateConfig } from "#lib/migrate-config/index.ts";
import { buildRunConfig, slugFromUrl } from "#init-project/steps/prepare/build-run-config.ts";
import { runConfigSchema, type RunConfig } from "#run-config/schema.ts";

const FIXTURES_DIR = join(import.meta.dirname, "..", "..", "..", "..", "..", "..", "fixtures", "config");

async function readFixture(): Promise<unknown> {
  return JSON.parse(await readFile(join(FIXTURES_DIR, "valid.json"), "utf8"));
}

async function loadFixtureConfig(): Promise<MigrateConfig> {
  return migrateConfigSchema.parse(await readFixture());
}

describe("slugFromUrl", () => {
  it("lowercases the host, strips www. and replaces dots with dashes", () => {
    expect(slugFromUrl("https://www.example.com")).toBe("example-com");
    expect(slugFromUrl("https://demo.webflow.io")).toBe("demo-webflow-io");
  });
});

describe("buildRunConfig", () => {
  it("derives smart defaults from the url and MigrateConfig", async () => {
    const config = await loadFixtureConfig();

    const result = buildRunConfig({ url: "https://example.com" }, config);

    expect(result.sourceUrl).toBe("https://example.com/");
    expect(result.projectName).toBe("example-com");
    expect(result.workspacePath).toBe(config.workspace.path);
  });

  it("lets fileConfig override the smart defaults", async () => {
    const config = await loadFixtureConfig();

    const result = buildRunConfig(
      {
        url: "https://example.com",
        fileConfig: { projectName: "from-file", workspacePath: "/from-file" },
      },
      config,
    );

    expect(result.projectName).toBe("from-file");
    expect(result.workspacePath).toBe("/from-file");
  });

  it("lets explicit flags override fileConfig", async () => {
    const config = await loadFixtureConfig();

    const result = buildRunConfig(
      {
        url: "https://example.com",
        projectName: "from-flag",
        fileConfig: { projectName: "from-file" },
      },
      config,
    );

    expect(result.projectName).toBe("from-flag");
  });

  it("produces a result that passes runConfigSchema", async () => {
    const config = await loadFixtureConfig();

    const result = buildRunConfig({ url: "https://demo.webflow.io" }, config);

    expect(() => runConfigSchema.parse(result)).not.toThrow();
    const parsed: RunConfig = runConfigSchema.parse(result);
    expect(parsed).toEqual(result);
  });

  it("throws when the merged result is invalid", async () => {
    const config = await loadFixtureConfig();

    expect(() =>
      buildRunConfig(
        {
          url: "https://example.com",
          fileConfig: { sourceUrl: "not-a-url" },
        },
        config,
      ),
    ).toThrow();
  });
});
