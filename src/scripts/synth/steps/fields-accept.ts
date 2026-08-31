import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { writeShardJson } from "#lib/synth-store/paths.ts";

import { responsePath, SCHEMA_SHARD_FILE } from "../constants/paths.ts";
import type { EntityAddress, SynthVertical } from "../types.ts";
import { printJson } from "../utils/print-json.ts";
import { readResponse } from "../utils/read-response.ts";
import { reportAcceptErrors } from "../utils/report-accept-errors.ts";
import { schemaErrors } from "../utils/schema-errors.ts";
import { stepLabel } from "../utils/step-label.ts";

export async function runFieldsAccept(
  projectPath: string,
  vertical: SynthVertical,
  address: EntityAddress,
): Promise<void> {
  const surfaceKey = vertical.surfaceKey(address);
  const response = await readResponse(responsePath(projectPath, vertical.id, surfaceKey, "fields"));

  const parsed = (await vertical.fieldsResponseSchema(projectPath, address)).safeParse(response);
  if (!parsed.success) {
    reportAcceptErrors(schemaErrors(parsed.error.issues));
    return;
  }

  const outcome = await vertical.acceptFields(projectPath, address, parsed.data);
  if (!outcome.ok) {
    reportAcceptErrors(outcome.errors);
    return;
  }

  const dir = vertical.surfaceDir(projectPath, address);
  await mkdir(dir, { recursive: true });
  await writeShardJson(join(dir, SCHEMA_SHARD_FILE), outcome.shard);
  await vertical.emitCodegen(projectPath, address, outcome.shard);

  printJson({ ok: true, step: stepLabel(vertical, "fields-accept"), entity: surfaceKey });
}
