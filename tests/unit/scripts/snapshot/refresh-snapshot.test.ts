import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { MockInstance } from "vitest";

import { INVENTORY_STEP_ID } from "#inventory/constants/ids.ts";
import { initManifest, readManifest, updateStep } from "#lib/manifest/index.ts";
import { openSnapshotStore, readOnlyClient } from "#lib/snapshot-store/index.ts";
import { STITCH_DIR, stitchRouteDirPath } from "#lib/stitch/paths.ts";
import { writeRunConfig } from "#run-config/load.ts";
import { SNAPSHOT_STEP_ID } from "#snapshot/constants/ids.ts";
import { runRefreshSnapshot } from "#snapshot/refresh-snapshot.ts";

import { createFakeFetchClient, fetchResponse } from "./fixtures/snapshot.ts";

const ORIGIN = "https://example.com";

describe("runRefreshSnapshot", () => {
  let projectPath: string;
  let logSpy: MockInstance<(...args: unknown[]) => void>;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "snapshot-refresh-test-"));
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    logSpy.mockRestore();
    await rm(projectPath, { recursive: true, force: true });
  });

  it("clears non-probe snapshot entries, stitch artifacts, and downstream steps, and resets inventory+snapshot steps to pending", async () => {
    await writeRunConfig(projectPath, {
      sourceUrl: `${ORIGIN}/`,
      projectName: "example-project",
      workspacePath: "../migrations/example-project",
    });
    await initManifest(projectPath, {
      toolVersion: "0.0.0",
      sourceUrl: `${ORIGIN}/`,
    });
    await updateStep(projectPath, INVENTORY_STEP_ID, {
      status: "done",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:01.000Z",
    });
    await updateStep(projectPath, SNAPSHOT_STEP_ID, {
      status: "done",
      startedAt: "2026-01-01T00:00:02.000Z",
      finishedAt: "2026-01-01T00:00:03.000Z",
    });

    const pageUrl = `${ORIGIN}/`;
    const probeUrl = `${ORIGIN}/__probe__`;
    const client = createFakeFetchClient({
      [pageUrl]: fetchResponse(pageUrl),
      [probeUrl]: fetchResponse(probeUrl),
    });
    const store = await openSnapshotStore(projectPath, client);
    await store.fetchInto(pageUrl, "page");
    const probeEntry = await store.fetchInto(probeUrl, "probe", {
      relativePath: join("probe", "root.html"),
    });

    const stitchDir = stitchRouteDirPath(projectPath, "/");
    await mkdir(stitchDir, { recursive: true });
    await writeFile(join(stitchDir, "index.json"), "{}");

    await updateStep(projectPath, "assets:media", { status: "done" });
    await updateStep(projectPath, "assets:fonts", { status: "done" });
    await updateStep(projectPath, "tokens:candidates", { status: "done" });
    await updateStep(projectPath, "tokens:theme", { status: "done" });
    await updateStep(projectPath, "discovery:route:/", { status: "done" });
    await updateStep(projectPath, "synth:collections:posts", { status: "done" });
    await updateStep(projectPath, "synth:globals:header", { status: "done" });
    await updateStep(projectPath, "synth:blocks:hero", { status: "done" });
    await updateStep(projectPath, "layout:route:/", { status: "done" });
    await updateStep(projectPath, "generate:scaffold", { status: "done" });
    await updateStep(projectPath, "generate:install", { status: "done" });

    await runRefreshSnapshot(projectPath);

    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ step: SNAPSHOT_STEP_ID, status: "refreshed" }));

    const refreshed = await openSnapshotStore(projectPath, readOnlyClient());
    expect(refreshed.has(pageUrl)).toBe(false);
    expect(refreshed.has(probeUrl)).toBe(true);
    expect(refreshed.entries()).toEqual([probeEntry]);

    const manifest = await readManifest(projectPath);
    expect(manifest.steps[INVENTORY_STEP_ID]).toEqual({ status: "pending" });
    expect(manifest.steps[SNAPSHOT_STEP_ID]).toEqual({ status: "pending" });

    expect(existsSync(join(projectPath, STITCH_DIR))).toBe(false);
    expect(manifest.steps["assets:media"]).toBeUndefined();
    expect(manifest.steps["assets:fonts"]).toBeUndefined();
    expect(manifest.steps["tokens:candidates"]).toBeUndefined();
    expect(manifest.steps["tokens:theme"]).toBeUndefined();
    expect(manifest.steps["discovery:route:/"]).toBeUndefined();
    expect(manifest.steps["synth:collections:posts"]).toBeUndefined();
    expect(manifest.steps["synth:globals:header"]).toBeUndefined();
    expect(manifest.steps["synth:blocks:hero"]).toBeUndefined();
    expect(manifest.steps["layout:route:/"]).toBeUndefined();
    expect(manifest.steps["generate:scaffold"]).toBeUndefined();
    expect(manifest.steps["generate:install"]).toBeUndefined();
  });
});
