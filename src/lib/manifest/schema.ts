import { z } from "zod";

export const MANIFEST_SCHEMA_VERSION = 1;

export const stepStatusSchema = z.enum(["pending", "running", "done", "failed", "skipped"]);
export type StepStatus = z.infer<typeof stepStatusSchema>;

export const stepRecordSchema = z.strictObject({
  status: stepStatusSchema,
  startedAt: z.iso.datetime().optional(),
  finishedAt: z.iso.datetime().optional(),
  resourceIds: z.record(z.string(), z.string()).optional(),
  artifacts: z.record(z.string(), z.strictObject({ path: z.string(), sha256: z.string() })).optional(),
  error: z
    .strictObject({
      code: z.string(),
      message: z.string(),
      logPath: z.string().optional(),
    })
    .optional(),
});
export type StepRecord = z.infer<typeof stepRecordSchema>;

export const manifestSchema = z.strictObject({
  schemaVersion: z.literal(MANIFEST_SCHEMA_VERSION),
  toolVersion: z.string(),
  sourceUrl: z.string(),
  localOnly: z.boolean(),
  steps: z.record(z.string(), stepRecordSchema),
});
export type Manifest = z.infer<typeof manifestSchema>;
