import { existsSync } from "node:fs";

import { artifactPath, writeArtifact } from "#ir/artifact.ts";
import { discoveryGlobalsArtifact } from "#ir/discovery.ts";
import { recordArtifact, updateStep } from "#lib/manifest/index.ts";
import { readStitchIndex } from "#lib/stitch/index.ts";
import { stitchIndexPath } from "#lib/stitch/paths.ts";

import { DISCOVERY_GLOBALS_ACCEPT_STEP_ID, DISCOVERY_GLOBALS_JUDGE_STEP_ID } from "../../constants/ids.ts";
import { GLOBALS_RESPONSE_RELATIVE_PATH } from "../../constants/paths.ts";
import { globalsResponseSchema } from "../../schemas/globals-response.ts";
import { readResponse } from "../../utils/read-response.ts";
import { reportAcceptErrors } from "../../utils/report-accept-errors.ts";
import { schemaErrors } from "../../utils/schema-errors.ts";

import { ingestGlobalsResponse } from "./ingest-globals-response.ts";
import { validateGlobalsResponse } from "./utils/ingest-globals-response.ts";

export async function runGlobalsAccept(projectPath: string): Promise<void> {
  const parsed = globalsResponseSchema.safeParse(await readResponse(projectPath, GLOBALS_RESPONSE_RELATIVE_PATH));
  if (!parsed.success) {
    reportAcceptErrors(schemaErrors(parsed.error.issues));
    return;
  }

  const response = parsed.data;
  if (!existsSync(stitchIndexPath(projectPath, response.source))) {
    reportAcceptErrors([
      {
        code: "UNKNOWN_ROUTE",
        where: "source",
        got: response.source,
        detail: "No stitch index was captured for this route.",
        fix: "Use the source route printed by the subject step.",
      },
    ]);
    return;
  }

  const sourceStitch = await readStitchIndex(projectPath, response.source);
  const errors = validateGlobalsResponse({ projectPath, response, sourceStitch });
  if (errors.length > 0) {
    reportAcceptErrors(errors);
    return;
  }

  const data = ingestGlobalsResponse({ response });
  await writeArtifact(projectPath, discoveryGlobalsArtifact, { provenance: "ai", data });
  await recordArtifact(
    projectPath,
    DISCOVERY_GLOBALS_ACCEPT_STEP_ID,
    discoveryGlobalsArtifact.kind,
    artifactPath(projectPath, discoveryGlobalsArtifact),
  );

  const finishedAt = new Date().toISOString();
  await updateStep(projectPath, DISCOVERY_GLOBALS_JUDGE_STEP_ID, { status: "done", finishedAt });
  await updateStep(projectPath, DISCOVERY_GLOBALS_ACCEPT_STEP_ID, { status: "done", finishedAt });

  console.log(
    JSON.stringify({
      ok: true,
      artifact: artifactPath(projectPath, discoveryGlobalsArtifact),
      types: data.types.length,
    }),
  );
}
