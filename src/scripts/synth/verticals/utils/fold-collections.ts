import {
  collectionsDataSchema,
  validatePageBinding,
  type CollectionsData,
  type PageBinding,
  type SectionBinding,
} from "#ir/collections.ts";
import { collectionIdSchema } from "#ir/common.ts";
import type { CollectionField } from "#ir/schema.ts";
import type { ContentRecord } from "#ir/content.ts";

export interface CollectionShard {
  key: string;
  schema: { label: string; fields: CollectionField[]; pageBinding: PageBinding };
  content: { items: ContentRecord[] };
  template: SectionBinding[];
}

export function foldCollections(shards: CollectionShard[]): CollectionsData {
  const collections = shards.map((shard) => {
    const errors = validatePageBinding({ fields: shard.schema.fields, pageBinding: shard.schema.pageBinding });
    if (errors.length > 0) throw new Error(`collection "${shard.key}": ${errors.join("; ")}`);
    return {
      key: collectionIdSchema.parse(shard.key),
      label: shard.schema.label,
      fields: shard.schema.fields,
      pageBinding: shard.schema.pageBinding,
      items: shard.content.items,
      template: shard.template,
    };
  });
  return collectionsDataSchema.parse({ collections });
}
