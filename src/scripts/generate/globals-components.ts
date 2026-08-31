import { blockTypeSchema, type BlockType } from "#ir/blocks.ts";
import { globalNameSchema, type GlobalDef } from "#ir/globals.ts";

import { globalComponentDir } from "./paths.ts";

export function chromeBlockTypeFor(def: GlobalDef): BlockType {
  return blockTypeSchema.parse({
    id: globalComponentDir(globalNameSchema.parse(def.name)),
    name: def.name,
    fields: def.fields,
    content: def.values,
  });
}
