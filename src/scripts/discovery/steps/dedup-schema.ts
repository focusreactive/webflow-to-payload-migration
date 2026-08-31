import { DISCOVERY_DEDUP_SCHEMA_STEP_ID } from "../constants/ids.ts";
import { dedupResponseSchema } from "../schemas/dedup-response.ts";
import { printResponseSchema } from "../utils/print-response-schema.ts";

export function runDedupSchema(projectPath: string): Promise<void> {
  return printResponseSchema(projectPath, DISCOVERY_DEDUP_SCHEMA_STEP_ID, dedupResponseSchema);
}
