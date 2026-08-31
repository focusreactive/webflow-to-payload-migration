import { blocksDataSchema, type BlockField, type BlocksData } from "#ir/blocks.ts";
import { blockTypeIdSchema } from "#ir/common.ts";

export interface BlockShard {
  key: string;
  schema: { name: string; fields: BlockField[]; collectionKey?: string };
  content: { literals: Record<string, unknown> };
}

export function foldBlocks(shards: BlockShard[], validCollectionKeys?: string[]): BlocksData {
  const validSet = validCollectionKeys !== undefined ? new Set(validCollectionKeys) : undefined;

  const blocks = shards.map((shard) => {
    if (
      validSet !== undefined
      && shard.schema.collectionKey !== undefined
      && !validSet.has(shard.schema.collectionKey)
    ) {
      throw new Error(`block "${shard.key}": collectionKey "${shard.schema.collectionKey}" is not a known collection`);
    }
    return {
      id: blockTypeIdSchema.parse(shard.key),
      name: shard.schema.name,
      fields: shard.schema.fields,
      ...(shard.schema.collectionKey !== undefined ? { collectionKey: shard.schema.collectionKey } : {}),
      content: shard.content.literals,
    };
  });

  return blocksDataSchema.parse({ blocks });
}
