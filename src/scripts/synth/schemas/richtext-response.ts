import { z } from "zod";

export const richTextMeasuredSchema = z.record(z.string(), z.record(z.string(), z.record(z.string(), z.string())));

export const richTextResponseSchema = z.strictObject({ measured: richTextMeasuredSchema });
export type RichTextResponse = z.infer<typeof richTextResponseSchema>;
