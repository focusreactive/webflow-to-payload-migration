import { readFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { INIT_PROJECT_STEP_ID } from "#init-project/constants/ids.ts";
import { ProjectCollisionError } from "#init-project/steps/init/project-collision-error.ts";
import { initProject } from "#init-project/steps/init/init-project.ts";
import { readManifest, updateStep } from "#lib/manifest/index.ts";
import { loadRunConfig, writeRunConfig } from "#run-config/load.ts";
import type { RunConfig } from "#run-config/schema.ts";

const TOOL_VERSION = "0.1.0";

function baseRunConfig(overrides?: Partial<RunConfig>): RunConfig {
  return {
    sourceUrl: "https://example.com/",
    projectName: "example-com",
    workspacePath: ".",
    ...overrides,
  };
}

describe("initProject", () => {
  let toolRootDir: string;

  beforeEach(async () => {
    toolRootDir = await mkdtemp(join(tmpdir(), "init-project-test-"));
  });

  afterEach(async () => {
    await rm(toolRootDir, { recursive: true, force: true });
  });

  it("creates the project folder with run-config.json, manifest.json and .gitignore", async () => {
    const runConfig = baseRunConfig();

    const result = await initProject(runConfig, { toolRootDir, toolVersion: TOOL_VERSION });

    expect(result).toEqual({ projectPath: join(toolRootDir, runConfig.projectName), created: true });

    const loadedRunConfig = await loadRunConfig(result.projectPath);
    expect(loadedRunConfig).toEqual(runConfig);

    const manifest = await readManifest(result.projectPath);
    expect(manifest.toolVersion).toBe(TOOL_VERSION);
    expect(manifest.sourceUrl).toBe(runConfig.sourceUrl);
    expect(manifest.steps[INIT_PROJECT_STEP_ID]?.status).toBe("done");

    const gitignore = await readFile(join(result.projectPath, ".gitignore"), "utf8");
    expect(gitignore).toBe(
      [".migration/snapshot/", ".migration/verification/", ".migration/logs/", ".migration/.env", ".env", ""].join(
        "\n",
      ),
    );
  });

  it("adopts an existing project of the same site without touching its run-config", async () => {
    const runConfig = baseRunConfig({ projectName: "run-twice" });
    const { projectPath } = await initProject(runConfig, { toolRootDir, toolVersion: TOOL_VERSION });

    // A later phase can edit run-config.json long after init first ran;
    // an adopted project must keep those edits.
    await writeRunConfig(projectPath, { ...runConfig, workspacePath: "/edited-later" });
    await updateStep(projectPath, INIT_PROJECT_STEP_ID, { status: "pending", finishedAt: undefined });

    const result = await initProject(runConfig, { toolRootDir, toolVersion: TOOL_VERSION });

    expect(result).toEqual({ projectPath, created: false });
    expect((await loadRunConfig(projectPath)).workspacePath).toBe("/edited-later");
    expect((await readManifest(projectPath)).steps[INIT_PROJECT_STEP_ID]?.status).toBe("done");
  });

  it("is safe to repeat right after a successful run", async () => {
    const runConfig = baseRunConfig({ projectName: "repeat" });

    await initProject(runConfig, { toolRootDir, toolVersion: TOOL_VERSION });
    const result = await initProject(runConfig, { toolRootDir, toolVersion: TOOL_VERSION });

    expect(result.created).toBe(false);
  });

  it("throws a collision and touches nothing when the folder holds no readable manifest", async () => {
    const runConfig = baseRunConfig({ projectName: "already-there" });
    const projectPath = join(toolRootDir, runConfig.projectName);
    const runConfigPath = join(projectPath, ".migration", "run-config.json");
    const sentinel = '{"sentinel":"do-not-touch"}\n';
    await mkdir(join(projectPath, ".migration"), { recursive: true });
    await writeFile(runConfigPath, sentinel);

    await expect(initProject(runConfig, { toolRootDir, toolVersion: TOOL_VERSION })).rejects.toThrow(
      ProjectCollisionError,
    );

    expect(await readFile(runConfigPath, "utf8")).toBe(sentinel);
    await expect(readFile(join(projectPath, ".migration", "manifest.json"), "utf8")).rejects.toThrow();
    await expect(readFile(join(projectPath, ".gitignore"), "utf8")).rejects.toThrow();
  });

  it("throws a collision naming the site that owns the folder", async () => {
    const runConfig = baseRunConfig({ projectName: "taken" });
    await initProject(baseRunConfig({ projectName: "taken", sourceUrl: "https://other.com/" }), {
      toolRootDir,
      toolVersion: TOOL_VERSION,
    });

    await expect(initProject(runConfig, { toolRootDir, toolVersion: TOOL_VERSION })).rejects.toThrow(
      /https:\/\/other\.com\//,
    );
  });
});
