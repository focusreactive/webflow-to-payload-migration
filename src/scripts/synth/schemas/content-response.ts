import { z } from "zod";

import { buildIngestRecordSchema, type IngestField } from "#ir/field-value.ts";

export function blockContentResponseSchema(fields: readonly IngestField[]): z.ZodType {
  return z.strictObject({ literals: buildIngestRecordSchema(fields) });
}

export function globalContentResponseSchema(fields: readonly IngestField[]): z.ZodType {
  return z.strictObject({ values: buildIngestRecordSchema(fields) });
}

export function collectionContentResponseSchema(fields: readonly IngestField[]): z.ZodType {
  return z.strictObject({ items: z.array(buildIngestRecordSchema(fields)) });
}
