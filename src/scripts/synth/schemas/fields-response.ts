import { z } from "zod";

import { blockFieldSchema } from "#ir/blocks.ts";
import { pageBindingSchema } from "#ir/collections.ts";
import { globalFieldSchema } from "#ir/globals.ts";
import { collectionFieldSchema } from "#ir/schema.ts";

export const blockFieldsResponseSchema = z.strictObject({
  name: z.string().min(1),
  fields: z.array(blockFieldSchema).min(1),
  collectionKey: z.string().min(1).optional(),
});
export type BlockFieldsResponse = z.infer<typeof blockFieldsResponseSchema>;

export const globalFieldsResponseSchema = z.strictObject({
  fields: z.array(globalFieldSchema).min(1),
});
export type GlobalFieldsResponse = z.infer<typeof globalFieldsResponseSchema>;

export const collectionFieldsResponseSchema = z.strictObject({
  label: z.string().min(1),
  fields: z.array(collectionFieldSchema).min(1),
  pageBinding: pageBindingSchema,
});
export type CollectionFieldsResponse = z.infer<typeof collectionFieldsResponseSchema>;

export const sectionFieldsResponseSchema = z.strictObject({
  itemFields: z.array(z.string().min(1)),
});
export type SectionFieldsResponse = z.infer<typeof sectionFieldsResponseSchema>;
