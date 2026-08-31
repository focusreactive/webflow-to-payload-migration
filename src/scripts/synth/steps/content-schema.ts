import type { SynthVertical } from "../types.ts";
import { printResponseSchema } from "../utils/print-response-schema.ts";

export async function runContentSchema(projectPath: string, vertical: SynthVertical, entityKey: string): Promise<void> {
  printResponseSchema(await vertical.contentResponseSchema(projectPath, entityKey));
}
