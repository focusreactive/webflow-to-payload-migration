import { artifactPath, readArtifact } from "#ir/artifact.ts";
import { discoveryBlocksArtifact, discoveryCollectionsArtifact, discoveryGlobalsArtifact } from "#ir/discovery.ts";
import { recordArtifact, withStep } from "#lib/manifest/index.ts";

import { DISCOVERY_FINALIZE_STEP_ID } from "../constants/ids.ts";

const FOLDED_ARTIFACTS = [discoveryGlobalsArtifact, discoveryBlocksArtifact, discoveryCollectionsArtifact];

export async function runFinalize(projectPath: string, force: boolean): Promise<void> {
  const status = await withStep(
    projectPath,
    DISCOVERY_FINALIZE_STEP_ID,
    async () => {
      await readArtifact(projectPath, discoveryGlobalsArtifact);
      const blocks = await readArtifact(projectPath, discoveryBlocksArtifact);
      await readArtifact(projectPath, discoveryCollectionsArtifact);
      for (const def of FOLDED_ARTIFACTS) {
        await recordArtifact(projectPath, DISCOVERY_FINALIZE_STEP_ID, def.kind, artifactPath(projectPath, def));
      }
      return blocks.data.types.length;
    },
    { force },
  );

  console.log(
    JSON.stringify({
      step: DISCOVERY_FINALIZE_STEP_ID,
      status: status !== undefined ? "done" : "skipped",
    }),
  );
}
