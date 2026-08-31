import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ManifestVersionError,
  clearStepsByPrefix,
  initManifest,
  readManifest,
  recordArtifact,
  updateStep,
  withStep,
} from "#lib/manifest/index.ts";
import { MANIFEST_SCHEMA_VERSION } from "#lib/manifest/schema.ts";

const INIT = {
  toolVersion: "0.1.0",
  sourceUrl: "https://example.com",
  localOnly: false,
};

describe("manifest", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "manifest-test-"));
    await initManifest(projectPath, INIT);
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  describe("initManifest / readManifest", () => {
    it("creates a valid manifest with empty steps", async () => {
      const manifest = await readManifest(projectPath);

      expect(manifest).toEqual({
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        ...INIT,
        steps: {},
      });
    });

    it("throws ManifestVersionError on incompatible schemaVersion", async () => {
      const manifestPath = join(projectPath, ".migration", "manifest.json");
      const raw = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
      await writeFile(manifestPath, JSON.stringify({ ...raw, schemaVersion: 99 }));

      await expect(readManifest(projectPath)).rejects.toThrow(ManifestVersionError);
    });
  });

  describe("updateStep", () => {
    it("merges a patch into an existing step record", async () => {
      await updateStep(projectPath, "setup", { status: "running" });
      await updateStep(projectPath, "setup", {
        resourceIds: { neonProjectId: "np-1" },
      });

      const manifest = await readManifest(projectPath);
      expect(manifest.steps["setup"]).toMatchObject({
        status: "running",
        resourceIds: { neonProjectId: "np-1" },
      });
    });
  });

  describe("withStep", () => {
    it("records done with timestamps on success", async () => {
      const result = await withStep(projectPath, "probe", () => Promise.resolve(42));

      expect(result).toBe(42);
      const step = (await readManifest(projectPath)).steps["probe"];
      expect(step?.status).toBe("done");
      expect(step?.startedAt).toBeDefined();
      expect(step?.finishedAt).toBeDefined();
    });

    it("records failed with error code and rethrows on exception", async () => {
      class SnapshotError extends Error {
        constructor() {
          super("boom");
          this.name = "SnapshotError";
        }
      }

      await expect(withStep(projectPath, "snapshot", () => Promise.reject(new SnapshotError()))).rejects.toThrow(
        "boom",
      );

      const step = (await readManifest(projectPath)).steps["snapshot"];
      expect(step?.status).toBe("failed");
      expect(step?.error).toMatchObject({
        code: "SnapshotError",
        message: "boom",
      });
    });

    it("skips a done step without force and does not call fn", async () => {
      await withStep(projectPath, "probe", () => Promise.resolve("first"));
      const fn = vi.fn(() => Promise.resolve("second"));

      const result = await withStep(projectPath, "probe", fn);

      expect(result).toBeUndefined();
      expect(fn).not.toHaveBeenCalled();
    });

    it("re-runs a done step with force", async () => {
      await withStep(projectPath, "probe", () => Promise.resolve("first"));

      const result = await withStep(projectPath, "probe", () => Promise.resolve("second"), { force: true });

      expect(result).toBe("second");
    });
  });

  describe("recordArtifact", () => {
    it("stores the artifact path and its sha256", async () => {
      const artifactFile = join(projectPath, "pages.json");
      const content = '{"pages":[]}';
      await writeFile(artifactFile, content);
      const expectedSha = createHash("sha256").update(content).digest("hex");

      await recordArtifact(projectPath, "extract", "pages", artifactFile);

      const step = (await readManifest(projectPath)).steps["extract"];
      expect(step?.artifacts?.["pages"]).toEqual({
        path: artifactFile,
        sha256: expectedSha,
      });
    });
  });

  describe("clearStepsByPrefix", () => {
    it("removes only steps whose id starts with the prefix", async () => {
      await updateStep(projectPath, "snapshot", { status: "done" });
      await updateStep(projectPath, "capture:route:/", { status: "done" });
      await updateStep(projectPath, "capture:route:/about", { status: "failed" });

      await clearStepsByPrefix(projectPath, "capture:route:");

      const manifest = await readManifest(projectPath);
      expect(Object.keys(manifest.steps)).toEqual(["snapshot"]);
    });
  });
});
