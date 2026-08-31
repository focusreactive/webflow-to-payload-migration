import { rm } from "node:fs/promises";
import type { MockInstance } from "vitest";

import { runAccept } from "#layout/steps/accept/accept.ts";
import { runFinalize } from "#layout/steps/finalize/finalize.ts";
import { readManifest } from "#lib/manifest/index.ts";

import { heroPayload, makeProject, writeResponse } from "../../fixtures/layout.ts";

describe("runFinalize", () => {
  let projectPath: string;
  let logSpy: MockInstance<typeof console.log>;

  beforeEach(async () => {
    projectPath = await makeProject();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    logSpy.mockRestore();
    await rm(projectPath, { recursive: true, force: true });
  });

  it("rejects when a planned static route unit has not been ingested yet", async () => {
    await expect(runFinalize(projectPath, false)).rejects.toThrow(/pending units/);
  });

  it("records the stage-grain layout step once every static route unit is ingested", async () => {
    await writeResponse(
      projectPath,
      "index",
      heroPayload({ route: "/", fields: { title: { kind: "literal", value: "Welcome home" } } }),
    );
    await runAccept(projectPath, "/");

    await runFinalize(projectPath, false);

    const manifest = await readManifest(projectPath);
    expect(manifest.steps["layout"]?.status).toBe("done");
    expect(manifest.steps["layout:route:/"]?.status).toBe("done");
  });

  it("skips a second run and leaves the step done", async () => {
    await writeResponse(
      projectPath,
      "index",
      heroPayload({ route: "/", fields: { title: { kind: "literal", value: "Welcome home" } } }),
    );
    await runAccept(projectPath, "/");
    await runFinalize(projectPath, false);

    logSpy.mockClear();
    await runFinalize(projectPath, false);

    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0]))).toEqual({
      step: "layout",
      status: "skipped",
      units: "unchanged",
    });
  });
});
