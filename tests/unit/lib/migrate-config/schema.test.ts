import { describe, expect, it } from "vitest";

import { migrateConfigSchema } from "#lib/migrate-config/schema.ts";

describe("migrateConfigSchema", () => {
  it("carries the workspace path and nothing else", () => {
    const parsed = migrateConfigSchema.parse({ workspace: { path: "../migrations" } });

    expect(Object.keys(parsed)).toEqual(["workspace"]);
    expect(parsed.workspace.path).toBe("../migrations");
  });

  it("defaults the workspace path when the file omits it", () => {
    expect(migrateConfigSchema.parse({}).workspace.path).toBe("../migrations");
  });

  it("rejects every block the public tool moved into constants", () => {
    for (const key of [
      "github",
      "neon",
      "vercel",
      "verification",
      "snapshot",
      "capture",
      "discovery",
      "logLevel",
    ]) {
      expect(() => migrateConfigSchema.parse({ workspace: { path: "../migrations" }, [key]: {} })).toThrow();
    }
  });
});
