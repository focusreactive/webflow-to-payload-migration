import { readArtifact } from "#ir/artifact.ts";
import { designTokensArtifact } from "#tokens/schemas/design-tokens.ts";

import { responsePath } from "../constants/paths.ts";
import { richTextResponseSchema } from "../schemas/richtext-response.ts";
import type { EntityAddress, SynthVertical } from "../types.ts";
import { printJson } from "../utils/print-json.ts";
import { readResponse } from "../utils/read-response.ts";
import { reportAcceptErrors } from "../utils/report-accept-errors.ts";
import { emitRichTextWrappers } from "../utils/richtext/index.ts";
import { schemaErrors } from "../utils/schema-errors.ts";
import { stepLabel } from "../utils/step-label.ts";

export async function runRichTextAccept(
  projectPath: string,
  vertical: SynthVertical,
  address: EntityAddress,
): Promise<void> {
  const entityKey = vertical.surfaceKey(address);
  const response = await readResponse(responsePath(projectPath, vertical.id, entityKey, "richtext"));

  const parsed = richTextResponseSchema.safeParse(response);
  if (!parsed.success) {
    reportAcceptErrors(schemaErrors(parsed.error.issues));
    return;
  }

  const written = await emitRichTextWrappers({
    measured: parsed.data.measured,
    fields: await vertical.surfaceFields(projectPath, address),
    tokens: (await readArtifact(projectPath, designTokensArtifact)).data,
    outDir: vertical.surfaceDir(projectPath, address),
  });
  printJson({ ok: true, step: stepLabel(vertical, "richtext-accept"), entity: entityKey, fields: written });
}
