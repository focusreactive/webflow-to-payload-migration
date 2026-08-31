import type { EntityAddress, SynthVertical } from "../../types.ts";
import { printJson } from "../../utils/print-json.ts";
import { stepLabel } from "../../utils/step-label.ts";

import { writeEntityInput } from "./build-entity-input.ts";

export async function runInputBuild(
  projectPath: string,
  vertical: SynthVertical,
  address: EntityAddress,
): Promise<void> {
  const entityKey = vertical.surfaceKey(address);
  const input = await writeEntityInput({
    projectPath,
    vertical: vertical.id,
    entityKey,
    fields: await vertical.surfaceFields(projectPath, address),
    literals: await vertical.surfaceLiterals(projectPath, address),
  });
  printJson({ step: stepLabel(vertical, "input-build"), entity: entityKey, input });
}
