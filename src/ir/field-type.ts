import { z } from "zod";

import { collectionIdSchema, type CollectionId } from "#ir/common.ts";

export const MAX_FIELD_TYPE_DEPTH = 5;

export const scalarTypeSchema = z.enum([
  "text",
  "richText",
  "number",
  "boolean",
  "date",
  "image",
  "file",
  "color",
  "url",
  "email",
  "phone",
  "video",
]);
export type ScalarType = z.infer<typeof scalarTypeSchema>;

export type FieldType =
  | { type: ScalarType }
  | { type: "reference"; collectionKey: CollectionId }
  | { type: "multiReference"; collectionKey: CollectionId }
  | { type: "option"; values: string[] }
  | { type: "unsupported" }
  | { type: "array"; element: FieldType }
  | { type: "group"; fields: GroupField[] };

export interface GroupField {
  name: string;
  type: FieldType;
  required: boolean;
}

function groupFieldSchema(typeSchema: z.ZodType<FieldType>): z.ZodType<GroupField> {
  return z.strictObject({
    name: z.string().min(1),
    type: typeSchema,
    required: z.boolean(),
  });
}

function leafArms() {
  return [
    z.strictObject({ type: scalarTypeSchema }),
    z.strictObject({ type: z.literal("reference"), collectionKey: collectionIdSchema }),
    z.strictObject({ type: z.literal("multiReference"), collectionKey: collectionIdSchema }),
    z.strictObject({ type: z.literal("option"), values: z.array(z.string().min(1)).min(1) }),
    z.strictObject({ type: z.literal("unsupported") }),
  ] as const;
}

function fieldTypeAtDepth(depth: number): z.ZodType<FieldType> {
  const leaves = leafArms();
  if (depth >= MAX_FIELD_TYPE_DEPTH) {
    return z.discriminatedUnion("type", [...leaves]);
  }
  const child = fieldTypeAtDepth(depth + 1);
  return z.discriminatedUnion("type", [
    ...leaves,
    z.strictObject({ type: z.literal("array"), element: child }),
    z.strictObject({ type: z.literal("group"), fields: z.array(groupFieldSchema(child)).min(1) }),
  ]);
}

export const fieldTypeSchema = fieldTypeAtDepth(0);
