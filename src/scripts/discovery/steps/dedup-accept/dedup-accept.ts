import { artifactPath, readArtifact, writeArtifact } from "#ir/artifact.ts";
import { discoveryBlocksArtifact } from "#ir/discovery.ts";
import { pagesArtifact } from "#ir/pages.ts";
import { recordArtifact, updateStep } from "#lib/manifest/index.ts";

import { DISCOVERY_DEDUP_ACCEPT_STEP_ID, DISCOVERY_DEDUP_JUDGE_STEP_ID } from "../../constants/ids.ts";
import { DEDUP_RESPONSE_RELATIVE_PATH } from "../../constants/paths.ts";
import { dedupResponseSchema } from "../../schemas/dedup-response.ts";
import { readStaticBlocksShards } from "../../utils/blocks-shards.ts";
import { readResponse } from "../../utils/read-response.ts";
import { reportAcceptErrors } from "../../utils/report-accept-errors.ts";
import { schemaErrors } from "../../utils/schema-errors.ts";

import { foldDedup } from "./fold-dedup.ts";
import { validateDedupResponse } from "./utils/dedup-accept.ts";

export async function runDedupAccept(projectPath: string): Promise<void> {
  const parsed = dedupResponseSchema.safeParse(await readResponse(projectPath, DEDUP_RESPONSE_RELATIVE_PATH));
  if (!parsed.success) {
    reportAcceptErrors(schemaErrors(parsed.error.issues));
    return;
  }

  const pages = (await readArtifact(projectPath, pagesArtifact)).data;
  const shards = (await readStaticBlocksShards(projectPath, pages)).map((shard) => shard.data);

  const errors = validateDedupResponse({ response: parsed.data, shards });
  if (errors.length > 0) {
    reportAcceptErrors(errors);
    return;
  }

  const data = foldDedup({ response: parsed.data, shards });
  await writeArtifact(projectPath, discoveryBlocksArtifact, { provenance: "ai", data });
  await recordArtifact(
    projectPath,
    DISCOVERY_DEDUP_ACCEPT_STEP_ID,
    discoveryBlocksArtifact.kind,
    artifactPath(projectPath, discoveryBlocksArtifact),
  );

  const finishedAt = new Date().toISOString();
  await updateStep(projectPath, DISCOVERY_DEDUP_JUDGE_STEP_ID, { status: "done", finishedAt });
  await updateStep(projectPath, DISCOVERY_DEDUP_ACCEPT_STEP_ID, { status: "done", finishedAt });

  console.log(
    JSON.stringify({
      ok: true,
      artifact: artifactPath(projectPath, discoveryBlocksArtifact),
      types: data.types.length,
    }),
  );
}
