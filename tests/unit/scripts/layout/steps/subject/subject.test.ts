import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { MockInstance } from "vitest";

import { runSubject } from "#layout/steps/subject/subject.ts";

import { makeProject } from "../../fixtures/layout.ts";

describe("runSubject", () => {
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

  it("prints the unit grounding and the path the response goes to", async () => {
    await runSubject(projectPath, "/");

    const subject = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      unit: { route: string; routeKey: string; stepId: string };
      stitches: { viewport: string; file: string }[];
      renderedHtmlPath: string;
      stylesPath: string;
      vocabulary: { id: string }[];
      chrome: unknown[];
      responsePath: string;
    };

    expect(subject.unit).toEqual({ kind: "static", route: "/", routeKey: "index", stepId: "layout:route:/" });
    expect(subject.stitches).toEqual([
      { viewport: "desktop", file: join(projectPath, ".migration/artifacts/stitch/index/desktop.png") },
    ]);
    expect(subject.renderedHtmlPath).toBe(join(projectPath, ".migration/snapshot/pages/index.rendered.html"));
    expect(subject.stylesPath).toBe(join(projectPath, ".migration/snapshot/pages/index.styles.json"));
    expect(subject.vocabulary.map((block) => block.id)).toEqual(["hero"]);
    expect(subject.chrome).toEqual([]);
    expect(subject.responsePath).toBe(join(projectPath, ".migration/steps/layout/index/response.json"));
  });

  it("creates the directory the response is written into", async () => {
    await runSubject(projectPath, "/");

    expect(existsSync(join(projectPath, ".migration/steps/layout/index"))).toBe(true);
  });

  it("rejects a route that is not a unit of this project", async () => {
    await expect(runSubject(projectPath, "/nope")).rejects.toThrow(/unknown layout unit/);
  });
});
