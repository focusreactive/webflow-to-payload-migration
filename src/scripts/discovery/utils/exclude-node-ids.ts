import { existsSync } from "node:fs";

import { artifactPath, readArtifact } from "#ir/artifact.ts";
import { discoveryGlobalsArtifact } from "#ir/discovery.ts";

export async function excludeNodeIds(projectPath: string): Promise<string[]> {
  if (!existsSync(artifactPath(projectPath, discoveryGlobalsArtifact))) return [];
  const { data } = await readArtifact(projectPath, discoveryGlobalsArtifact);
  return data.types.flatMap((type) => type.exemplar.nodeIds);
}
