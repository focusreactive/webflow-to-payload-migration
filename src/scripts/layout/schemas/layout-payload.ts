import { z } from "zod";

import { llmValueSchemaForFieldType } from "#ir/field-value.ts";
import type { BlockField, BlockType } from "#ir/blocks.ts";

export const missedFieldSchema = z.object({
  collectionKey: z.string().min(1),
  fieldName: z.string().min(1),
  evidence: z.string().min(1),
});
export type MissedField = z.infer<typeof missedFieldSchema>;

function fieldSourceSchema(field: BlockField): z.ZodType {
  const literalArm = z.object({ kind: z.literal("literal"), value: llmValueSchemaForFieldType(field.type) });
  
  return field.required ? literalArm : z.union([literalArm, z.null()]);
}

function instanceArm(block: BlockType): z.ZodObject<z.ZodRawShape> {
  const fieldShape: Record<string, z.ZodType> = {};

  for (const field of block.fields) fieldShape[field.name] = fieldSourceSchema(field);

  return z.object({
    blockType: z.literal(String(block.id)),
    anchorMigId: z.string().min(1),
    confidence: z.number().min(0).max(1),
    fields: z.object(fieldShape),
  });
}

export function buildLayoutPayloadSchema(opts: { route: string; blocks: BlockType[] }): z.ZodType {
  const arms = opts.blocks.map((block) => instanceArm(block));
  const [first, ...rest] = arms;

  if (first === undefined) {
    throw new Error("layout payload: the block vocabulary is empty — run the blocks stage first");
  }

  const instanceSchema =
    rest.length === 0 ? first : z.discriminatedUnion("blockType", [first, ...rest] as [typeof first, ...typeof rest]);

  return z.object({
    unit: z.object({ kind: z.literal("static"), route: z.literal(opts.route) }),
    missedFields: z.array(missedFieldSchema),
    blocks: z.array(instanceSchema),
  });
}
