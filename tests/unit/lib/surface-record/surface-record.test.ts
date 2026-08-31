import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { readSurfaceRecord, writeSurfaceRecord } from "#lib/surface-record/index.ts";
import { recordPath } from "#lib/surface-record/paths.ts";

describe("surface record", () => {
  it("round-trips a record through the synth entry dir", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "surface-record-"));

    await writeSurfaceRecord(projectPath, "blocks", "hero", {
      surface: "hero",
      phase: "done",
      acceptedAt: "2026-09-01T00:00:00.000Z",
      checks: [{ name: "component", ok: true, detail: "Component.tsx is present" }],
    });

    expect(await readSurfaceRecord(projectPath, "blocks", "hero")).toEqual({
      surface: "hero",
      phase: "done",
      acceptedAt: "2026-09-01T00:00:00.000Z",
      checks: [{ name: "component", ok: true, detail: "Component.tsx is present" }],
    });

    const raw = JSON.parse(await readFile(recordPath(projectPath, "blocks", "hero"), "utf8")) as { phase: string };
    expect(raw.phase).toBe("done");
  });

  it("returns undefined for a surface that was never accepted", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "surface-record-"));
    expect(await readSurfaceRecord(projectPath, "blocks", "absent")).toBeUndefined();
  });
});
