import { describe, expect, it } from "vitest";

import { gateCommands } from "#generate/gates.ts";
import { GATE_NAMES } from "#generate/steps.ts";

describe("gateCommands", () => {
  it("runs every gate through pnpm, never through bun or turbo", () => {
    for (const gate of GATE_NAMES) {
      for (const command of gateCommands(gate)) {
        expect(command[0]).not.toBe("bun");
        expect(command).not.toContain("turbo");
      }
    }
  });

  it("carries no database migration gate", () => {
    expect(GATE_NAMES).not.toContain("migrate");
    expect(GATE_NAMES).toEqual(["install", "types", "importmap", "seed", "build", "lint"]);
  });

  it("installs, then generates types and the import map, then seeds, builds and lints", () => {
    expect(gateCommands("install")).toEqual([["install", "--ignore-workspace"]]);
    expect(gateCommands("seed")).toEqual([["run", "seed"]]);
    expect(gateCommands("build")).toEqual([["run", "build"]]);
  });
});
