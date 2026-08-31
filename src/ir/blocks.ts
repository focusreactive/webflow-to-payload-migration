import { z } from "zod";

import { type ArtifactDef } from "#ir/artifact.ts";
import { blockTypeIdSchema, collectionIdSchema } from "#ir/common.ts";
import { fieldTypeSchema } from "#ir/field-type.ts";

export const BLOCKS_SCHEMA_VERSION = 3;

export const blockFieldSchema = z.strictObject({
  name: z.string().min(1),
  label: z.string().min(1).optional(),
  type: fieldTypeSchema,
  required: z.boolean(),
});
export type BlockField = z.infer<typeof blockFieldSchema>;

export const blockTypeSchema = z.strictObject({
  id: blockTypeIdSchema,
  name: z.string().min(1),
  fields: z.array(blockFieldSchema),
  collectionKey: collectionIdSchema.optional(),
  content: z.record(z.string().min(1), z.json()),
});
export type BlockType = z.infer<typeof blockTypeSchema>;

export const blocksDataSchema = z.strictObject({ blocks: z.array(blockTypeSchema) });
export type BlocksData = z.infer<typeof blocksDataSchema>;

export const blocksArtifact: ArtifactDef<BlocksData> = {
  kind: "blocks",
  relativePath: "blocks.json",
  schemaVersion: BLOCKS_SCHEMA_VERSION,
  dataSchema: blocksDataSchema,
};
