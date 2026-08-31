import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { artifactPath, readArtifact, writeArtifact } from "#ir/artifact.ts";
import { recordArtifact, updateStep, withStep } from "#lib/manifest/index.ts";
import { openSnapshotStore, readOnlyClient } from "#lib/snapshot-store/index.ts";

import { tokenCandidatesArtifact } from "../../schemas/token-candidates.ts";
import { RESPONSE_RELATIVE_PATH } from "../../constants/paths.ts";
import {
  TOKENS_ACCEPT_STEP_ID,
  TOKENS_CANDIDATES_STEP_ID,
  TOKENS_JUDGE_STEP_ID,
  TOKENS_THEME_STEP_ID,
} from "../../constants/ids.ts";

import { buildTokenCandidates } from "./services/build-candidates.ts";

export async function runCandidates(projectPath: string, force: boolean): Promise<void> {
  const computed = await withStep(
    projectPath,
    TOKENS_CANDIDATES_STEP_ID,
    async () => {
      const store = await openSnapshotStore(projectPath, readOnlyClient());
      const data = await buildTokenCandidates({ projectPath, store });

      await writeArtifact(projectPath, tokenCandidatesArtifact, { provenance: "published", data });
      await recordArtifact(
        projectPath,
        TOKENS_CANDIDATES_STEP_ID,
        "token-candidates",
        artifactPath(projectPath, tokenCandidatesArtifact),
      );

      return data;
    },
    { force },
  );

  if (computed !== undefined) {
    for (const stepId of [TOKENS_JUDGE_STEP_ID, TOKENS_ACCEPT_STEP_ID, TOKENS_THEME_STEP_ID]) {
      await updateStep(projectPath, stepId, { status: "pending", finishedAt: undefined, error: undefined });
    }
  }

  const candidates = computed ?? (await readArtifact(projectPath, tokenCandidatesArtifact)).data;

  const responsePath = join(projectPath, RESPONSE_RELATIVE_PATH);
  await mkdir(dirname(responsePath), { recursive: true });

  console.log(`response path: ${responsePath}\n`);
  console.log(JSON.stringify(candidates, null, 2));
}
