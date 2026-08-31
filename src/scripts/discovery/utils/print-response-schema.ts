import { z } from "zod";

import { updateStep } from "#lib/manifest/index.ts";

export async function printResponseSchema(projectPath: string, stepId: string, schema: z.ZodType): Promise<void> {
  console.log(JSON.stringify(z.toJSONSchema(schema, { io: "input" }), null, 2));

  await updateStep(projectPath, stepId, { status: "done", finishedAt: new Date().toISOString() });
}
