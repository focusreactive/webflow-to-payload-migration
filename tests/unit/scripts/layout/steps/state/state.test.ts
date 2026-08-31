import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { MockInstance } from "vitest";

import { runAccept } from "#layout/steps/accept/accept.ts";
import { runState } from "#layout/steps/state/state.ts";

import { heroPayload, makeProject, writeResponse } from "../../fixtures/layout.ts";

describe("runState", () => {
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

  it("prints a row per unit step plus the stage-grain step", async () => {
    await runState(projectPath);

    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0]))).toEqual({
      phase: "layout",
      steps: [
        { id: "layout:route:/", status: "pending", route: "/", routeKey: "index" },
        { id: "layout", status: "pending" },
      ],
    });
  });

  it("reflects a unit closed by acceptance", async () => {
    await writeResponse(
      projectPath,
      "index",
      heroPayload({ route: "/", fields: { title: { kind: "literal", value: "Welcome home" } } }),
    );
    await runAccept(projectPath, "/");

    logSpy.mockClear();
    await runState(projectPath);

    const state = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as { steps: { id: string; status: string }[] };
    expect(state.steps.find((step) => step.id === "layout:route:/")?.status).toBe("done");
    expect(state.steps.find((step) => step.id === "layout")?.status).toBe("pending");
  });

  it("does not write anything", async () => {
    await runState(projectPath);

    expect(existsSync(join(projectPath, ".migration/steps/layout"))).toBe(false);
  });
});
