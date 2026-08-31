import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveSnapshotPaths } from "#lib/snapshot-store/resolve-snapshot-paths.ts";

describe("resolveSnapshotPaths", () => {
  it("returns empty paths for a route without a snapshot entry", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "read-captures-"));
    await mkdir(join(projectPath, ".migration/snapshot"), { recursive: true });
    await writeFile(
      join(projectPath, ".migration/snapshot/index.json"),
      JSON.stringify({ schemaVersion: 2, entries: {} }),
    );
    const paths = await resolveSnapshotPaths(projectPath, "/missing");
    expect(paths).toEqual({ renderedHtmlPath: "", stylesPath: "" });
  });
});
