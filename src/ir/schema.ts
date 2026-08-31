import { z } from "zod";

import { collectionIdSchema } from "#ir/common.ts";
import { fieldTypeSchema } from "#ir/field-type.ts";

export const RESERVED_FIELD_NAMES = ["id", "_provenance", "_confidence"] as const;
const reservedFieldNames = new Set<string>(RESERVED_FIELD_NAMES);

export const fieldNameSchema = z
  .string()
  .min(1)
  .refine((name) => !reservedFieldNames.has(name), {
    message: `field name must not be one of the reserved record keys: ${RESERVED_FIELD_NAMES.join(", ")}`,
  });

export const collectionFieldSchema = z.strictObject({
  name: fieldNameSchema,
  label: z.string().min(1).optional(),
  type: fieldTypeSchema,
  required: z.boolean(),
  localized: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type CollectionField = z.infer<typeof collectionFieldSchema>;

export const collectionSchema = z.strictObject({
  key: collectionIdSchema,
  label: z.string().min(1),
  slugField: z.string().min(1),
  fields: z.array(collectionFieldSchema).min(1),
});
export type CollectionSchema = z.infer<typeof collectionSchema>;
