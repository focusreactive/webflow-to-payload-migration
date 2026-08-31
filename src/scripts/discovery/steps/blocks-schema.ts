import { DISCOVERY_BLOCKS_SCHEMA_STEP_ID } from "../constants/ids.ts";
import { blocksResponseSchema } from "../schemas/blocks-response.ts";
import { printResponseSchema } from "../utils/print-response-schema.ts";

export function runBlocksSchema(projectPath: string): Promise<void> {
  return printResponseSchema(projectPath, DISCOVERY_BLOCKS_SCHEMA_STEP_ID, blocksResponseSchema);
}
