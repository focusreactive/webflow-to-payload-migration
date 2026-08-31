import { describe, expect, it } from "vitest";

import { runConfigSchema } from "#run-config/schema.ts";

describe("runConfigSchema", () => {
  it("carries exactly the three fields a public run needs", () => {
    const parsed = runConfigSchema.parse({
      sourceUrl: "https://example.com/",
      projectName: "example-com",
      workspacePath: "../migrations",
    });

    expect(Object.keys(parsed).sort()).toEqual(["projectName", "sourceUrl", "workspacePath"]);
  });

  it("rejects the flags the public tool dropped", () => {
    for (const extra of [
      { localOnly: true },
      { headless: true },
      { includeRoutes: ["/"] },
      { forceAdapter: "webflow" },
    ]) {
      expect(() =>
        runConfigSchema.parse({
          sourceUrl: "https://example.com/",
          projectName: "example-com",
          workspacePath: "../migrations",
          ...extra,
        }),
      ).toThrow();
    }
  });
});
