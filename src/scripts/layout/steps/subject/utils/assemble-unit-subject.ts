import { existsSync } from "node:fs";

import { artifactPath, readArtifact } from "#ir/artifact.ts";
import { globalsArtifact } from "#ir/globals.ts";
import { resolveGlobalSource } from "#globals/source.ts";

import type { ChromeAnchor } from "../../../types.ts";

export async function readChrome(projectPath: string): Promise<ChromeAnchor[]> {
  if (!existsSync(artifactPath(projectPath, globalsArtifact))) return [];
  const { data } = await readArtifact(projectPath, globalsArtifact);

  return Promise.all(
    data.globals.map(async (entry) => {
      const source = await resolveGlobalSource(projectPath, entry.name);
      return { name: entry.name, sourceRoute: source.route, anchorMigId: source.anchorMigId };
    }),
  );
}
