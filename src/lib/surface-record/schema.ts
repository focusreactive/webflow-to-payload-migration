import { z } from "zod";

export const surfacePhaseSchema = z.enum(["fields", "input", "richtext", "author", "done"]);
export type SurfacePhase = z.infer<typeof surfacePhaseSchema>;

export const surfaceCheckSchema = z.strictObject({
  name: z.string().min(1),
  ok: z.boolean(),
  detail: z.string(),
});
export type SurfaceCheck = z.infer<typeof surfaceCheckSchema>;

export const surfaceRecordSchema = z.strictObject({
  surface: z.string().min(1),
  phase: surfacePhaseSchema,
  acceptedAt: z.iso.datetime().optional(),
  checks: z.array(surfaceCheckSchema).optional(),
});
export type SurfaceRecord = z.infer<typeof surfaceRecordSchema>;
