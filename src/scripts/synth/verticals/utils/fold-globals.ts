import { globalsDataSchema, type GlobalField, type GlobalsData } from "#ir/globals.ts";

export interface GlobalShard {
  name: string;
  schema: { fields: GlobalField[] };
  content: { values: Record<string, unknown> };
}

export function foldGlobals(shards: GlobalShard[]): GlobalsData {
  const globals = shards.map((shard) => ({
    name: shard.name,
    fields: shard.schema.fields,
    values: shard.content.values,
  }));
  return globalsDataSchema.parse({ globals });
}
