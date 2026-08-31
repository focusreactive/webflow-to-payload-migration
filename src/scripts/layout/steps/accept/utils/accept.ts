import { existsSync } from "node:fs";

import { artifactPath, readArtifact } from "#ir/artifact.ts";
import { mediaAssetsArtifact } from "#ir/assets.ts";

export async function readKnownAssetIds(projectPath: string): Promise<ReadonlySet<string> | undefined> {
  if (!existsSync(artifactPath(projectPath, mediaAssetsArtifact))) return undefined;
  const { data } = await readArtifact(projectPath, mediaAssetsArtifact);

  return new Set(data.assets.map((asset) => String(asset.assetId)));
}
