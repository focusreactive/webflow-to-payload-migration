import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveProject } from "#init-project/steps/prepare/resolve-project.ts";
import type { RunConfig } from "#run-config/schema.ts";

const PROJECT_NAME = "acme-com";

function baseRunConfig(overrides?: Partial<RunConfig>): RunConfig {
  return {
    sourceUrl: "https://acme.com/",
    projectName: PROJECT_NAME,
    workspacePath: ".",
    ...overrides,
  };
}

describe("resolveProject", () => {
  let toolRootDir: string;
  let projectPath: string;

  beforeEach(async () => {
    toolRootDir = await mkdtemp(join(tmpdir(), "resolve-project-test-"));
    projectPath = join(toolRootDir, PROJECT_NAME);
  });

  afterEach(async () => {
    await rm(toolRootDir, { recursive: true, force: true });
  });

  async function writeManifest(content: string): Promise<void> {
    await mkdir(join(projectPath, ".migration"), { recursive: true });
    await writeFile(join(projectPath, ".migration", "manifest.json"), content);
  }

  function manifestJson(opts: { sourceUrl: string; steps?: Record<string, { status: string }> }): string {
    return JSON.stringify({
      schemaVersion: 1,
      toolVersion: "0.1.0",
      sourceUrl: opts.sourceUrl,
      steps: opts.steps ?? {},
    });
  }

  it("reports a new project when the folder does not exist", async () => {
    const resolved = await resolveProject(baseRunConfig(), { toolRootDir });

    expect(resolved).toEqual({ projectPath, verdict: "new", manifest: null });
  });

  it("reports an existing project when the manifest sourceUrl matches", async () => {
    await writeManifest(
      manifestJson({ sourceUrl: "https://acme.com/", steps: { "init-project": { status: "done" } } }),
    );

    const resolved = await resolveProject(baseRunConfig(), { toolRootDir });

    expect(resolved).toEqual({
      projectPath,
      verdict: "existing",
      manifest: { sourceUrl: "https://acme.com/", toolVersion: "0.1.0", initProject: "done" },
    });
  });

  it("reports the init step as pending when the manifest has no such row", async () => {
    await writeManifest(manifestJson({ sourceUrl: "https://acme.com/", steps: { probe: { status: "done" } } }));

    const resolved = await resolveProject(baseRunConfig(), { toolRootDir });

    expect(resolved.verdict).toBe("existing");
    expect(resolved.manifest?.initProject).toBe("pending");
  });

  it("matches sourceUrls that differ only by a trailing slash or a hash", async () => {
    await writeManifest(manifestJson({ sourceUrl: "https://acme.com/#top" }));

    const resolved = await resolveProject(baseRunConfig({ sourceUrl: "https://acme.com" }), { toolRootDir });

    expect(resolved.verdict).toBe("existing");
  });

  it("reports a collision when the manifest belongs to another site", async () => {
    await writeManifest(manifestJson({ sourceUrl: "https://other.com/" }));

    const resolved = await resolveProject(baseRunConfig(), { toolRootDir });

    expect(resolved.verdict).toBe("collision");
    expect(resolved.manifest?.sourceUrl).toBe("https://other.com/");
  });

  it("reports a collision when the folder is occupied without a manifest", async () => {
    await mkdir(projectPath, { recursive: true });

    const resolved = await resolveProject(baseRunConfig(), { toolRootDir });

    expect(resolved).toEqual({ projectPath, verdict: "collision", manifest: null });
  });

  it("reports a collision when the manifest cannot be read", async () => {
    await writeManifest("{ not json");

    const resolved = await resolveProject(baseRunConfig(), { toolRootDir });

    expect(resolved).toEqual({ projectPath, verdict: "collision", manifest: null });
  });

  it("does not depend on the manifest schema version", async () => {
    await writeManifest(JSON.stringify({ schemaVersion: 99, toolVersion: "9.9.9", sourceUrl: "https://acme.com/" }));

    const resolved = await resolveProject(baseRunConfig(), { toolRootDir });

    expect(resolved.verdict).toBe("existing");
    expect(resolved.manifest?.toolVersion).toBe("9.9.9");
  });
});
