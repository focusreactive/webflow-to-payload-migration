import { z } from "zod";

export function printResponseSchema(schema: z.ZodType): void {
  process.stdout.write(`${JSON.stringify(z.toJSONSchema(schema, { io: "input" }), null, 2)}\n`);
}
