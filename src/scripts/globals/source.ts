import { readArtifact } from "#ir/artifact.ts";
import { discoveryGlobalsArtifact } from "#ir/discovery.ts";

export interface GlobalAnchor {
  route: string;
  anchorMigId: string;
}

export async function resolveGlobalSource(projectPath: string, name: string): Promise<GlobalAnchor> {
  const { data } = await readArtifact(projectPath, discoveryGlobalsArtifact);
  const type = data.types.find((entry) => entry.name === name);
  if (type === undefined) {
    throw new Error(`no discovery global type for "${name}" — cannot resolve screenshot anchor`);
  }
  return {
    route: type.exemplar.route,
    anchorMigId: type.exemplar.nodeIds[0]!,
  };
}
