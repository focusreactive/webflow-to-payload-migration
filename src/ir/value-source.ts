import { z } from "zod";

export function valueSource<V extends z.ZodType>(valueSchema: V) {
  return z.strictObject({ kind: z.literal("literal"), value: valueSchema });
}

export const anyValueSourceSchema = valueSource(z.json());
export type AnyValueSource = z.infer<typeof anyValueSourceSchema>;
