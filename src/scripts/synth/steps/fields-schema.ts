import type { EntityAddress, SynthVertical } from "../types.ts";
import { printResponseSchema } from "../utils/print-response-schema.ts";

export async function runFieldsSchema(
  projectPath: string,
  vertical: SynthVertical,
  address: EntityAddress,
): Promise<void> {
  printResponseSchema(await vertical.fieldsResponseSchema(projectPath, address));
}
