import { artifactPath, readArtifact, writeArtifact } from "#ir/artifact.ts";
import { detectArtifact, type DetectData } from "#ir/detect.ts";
import { readManifest, recordArtifact, withStep } from "#lib/manifest/index.ts";
import { readProbeData } from "#probe/read-probe-data.ts";

import { DETECT_STEP_ID } from "./constants/ids.ts";
import { detectPlatform } from "./detect-platform.ts";

export async function runDetect(projectPath: string, force: boolean): Promise<void> {
  const manifest = await readManifest(projectPath);
  const wasSkipped = manifest.steps[DETECT_STEP_ID]?.status === "done" && !force;

  const computed = await withStep(
    projectPath,
    DETECT_STEP_ID,
    async () => {
      const data = await readProbeData(projectPath);
      const detect = detectPlatform(data);

      await writeArtifact(projectPath, detectArtifact, {
        provenance: "published",
        data: detect,
      });
      await recordArtifact(projectPath, DETECT_STEP_ID, "detect", artifactPath(projectPath, detectArtifact));

      return detect;
    },
    { force },
  );

  const detect: DetectData =
    wasSkipped ? (await readArtifact(projectPath, detectArtifact)).data : (computed as DetectData);

  console.log(
    JSON.stringify({
      verdict: detect.verdict,
      scores: { webflow: detect.scores.webflow.score },
    }),
  );
}
