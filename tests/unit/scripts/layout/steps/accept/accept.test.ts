import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { MockInstance } from "vitest";

import { runAccept } from "#layout/steps/accept/accept.ts";
import { artifactPath, readNdjsonArtifact } from "#ir/artifact.ts";
import { layoutRouteArtifactFor, layoutUnitMetaSchema } from "#ir/layout.ts";
import { readManifest } from "#lib/manifest/index.ts";

import { heroPayload, makeProject, writeResponse } from "../../fixtures/layout.ts";

describe("runAccept", () => {
  let projectPath: string;
  let logSpy: MockInstance<typeof console.log>;

  beforeEach(async () => {
    projectPath = await makeProject();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    logSpy.mockRestore();
    process.exitCode = 0;
    await rm(projectPath, { recursive: true, force: true });
  });

  it("ingests a static unit into layout/routes/<routeKey>.ndjson", async () => {
    await writeResponse(
      projectPath,
      "index",
      heroPayload({ route: "/", fields: { title: { kind: "literal", value: "Welcome home" } } }),
    );

    await runAccept(projectPath, "/");

    const { meta, items } = await readNdjsonArtifact(projectPath, layoutRouteArtifactFor("index"));
    const metaRecord = meta as Record<string, unknown>;
    expect(layoutUnitMetaSchema.parse({ unitKind: metaRecord["unitKind"], route: metaRecord["route"] })).toBeDefined();
    expect(metaRecord["unitKind"]).toBe("static");
    expect(items).toHaveLength(1);
    const manifest = await readManifest(projectPath);
    expect(manifest.steps["layout:route:/"]?.status).toBe("done");
  });

  it("prints every error and writes nothing when the response does not hold up", async () => {
    await writeResponse(
      projectPath,
      "index",
      heroPayload({
        route: "/",
        anchorMigId: "mig-nope",
        fields: { title: { kind: "literal", value: "Welcome home" } },
      }),
    );

    await runAccept(projectPath, "/");

    expect(process.exitCode).toBe(1);
    const report = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as { ok: boolean; errors: { code: string }[] };
    expect(report.ok).toBe(false);
    expect(report.errors.map((error) => error.code)).toEqual(["UNKNOWN_ANCHOR"]);
    expect(existsSync(artifactPath(projectPath, layoutRouteArtifactFor("index")))).toBe(false);
    const manifest = await readManifest(projectPath);
    expect(manifest.steps["layout:route:/"]).toBeUndefined();
  });

  it("fails loud when the judge never wrote a response", async () => {
    await expect(runAccept(projectPath, "/")).rejects.toThrow(
      join(projectPath, ".migration/steps/layout/index/response.json"),
    );
  });

  it("rejects a route that is not a unit of this project", async () => {
    await expect(runAccept(projectPath, "/nope")).rejects.toThrow(/unknown layout unit/);
  });
});
