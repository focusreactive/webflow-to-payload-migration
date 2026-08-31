import { rm } from "node:fs/promises";
import type { MockInstance } from "vitest";

import { runSchema } from "#layout/steps/schema/schema.ts";

import { makeProject } from "../../fixtures/layout.ts";

describe("runSchema", () => {
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

  it("prints the whole payload contract, typed by the vocabulary and pinned to the unit route", async () => {
    await runSchema(projectPath, "/");

    const contract = JSON.stringify(JSON.parse(String(logSpy.mock.calls[0]?.[0])));
    expect(contract).toContain('"missedFields"');
    expect(contract).toContain('"anchorMigId"');
    expect(contract).toContain('"hero"');
    expect(contract).toContain('"const":"/"');
    expect(contract).not.toContain("$ref");
  });

  it("rejects a route that is not a unit of this project", async () => {
    await expect(runSchema(projectPath, "/nope")).rejects.toThrow(/unknown layout unit/);
  });
});
