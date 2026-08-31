import { DISCOVERY_GLOBALS_SCHEMA_STEP_ID } from "../constants/ids.ts";
import { globalsResponseSchema } from "../schemas/globals-response.ts";
import { printResponseSchema } from "../utils/print-response-schema.ts";

export function runGlobalsSchema(projectPath: string): Promise<void> {
  return printResponseSchema(projectPath, DISCOVERY_GLOBALS_SCHEMA_STEP_ID, globalsResponseSchema);
}
