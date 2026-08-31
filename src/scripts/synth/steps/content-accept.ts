import { writeShardJson } from "#lib/synth-store/paths.ts";

import { contentShardPath, responsePath } from "../constants/paths.ts";
import type { SynthVertical } from "../types.ts";
import { printJson } from "../utils/print-json.ts";
import { readResponse } from "../utils/read-response.ts";
import { reportAcceptErrors } from "../utils/report-accept-errors.ts";
import { schemaErrors } from "../utils/schema-errors.ts";
import { stepLabel } from "../utils/step-label.ts";

export async function runContentAccept(projectPath: string, vertical: SynthVertical, entityKey: string): Promise<void> {
  const response = await readResponse(responsePath(projectPath, vertical.id, entityKey, "content"));

  const parsed = (await vertical.contentResponseSchema(projectPath, entityKey)).safeParse(response);
  if (!parsed.success) {
    reportAcceptErrors(schemaErrors(parsed.error.issues));
    return;
  }

  const outcome = await vertical.acceptContent(projectPath, entityKey, parsed.data);
  if (!outcome.ok) {
    reportAcceptErrors(outcome.errors);
    return;
  }

  await writeShardJson(contentShardPath(projectPath, vertical.id, entityKey), outcome.shard);
  printJson({ ok: true, step: stepLabel(vertical, "content-accept"), entity: entityKey });
}
