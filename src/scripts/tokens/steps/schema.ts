import { z } from "zod";

import { updateStep } from "#lib/manifest/index.ts";

import { tokensResponseSchema } from "../schemas/judgement-response-schema.ts";
import { TOKENS_SCHEMA_STEP_ID } from "../constants/ids.ts";

export async function runSchema(projectPath: string): Promise<void> {
  console.log(JSON.stringify(z.toJSONSchema(tokensResponseSchema, { io: "input" }), null, 2));

  await updateStep(projectPath, TOKENS_SCHEMA_STEP_ID, {
    status: "done",
    finishedAt: new Date().toISOString(),
  });
}
