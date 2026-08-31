import { type BlocksData } from "#ir/blocks.ts";
import { type CollectionEntry } from "#ir/collections.ts";
import { type GlobalsData } from "#ir/globals.ts";

interface IrFieldListEntry {
  name: string;
  type: unknown;
  required: boolean;
}

export function fieldDefsFor(fields: readonly IrFieldListEntry[]): unknown[] {
  return fields.map((field) => ({ name: field.name, type: field.type, required: field.required }));
}

function emitMapFile(constName: string, entries: [string, unknown][], extra = ""): string {
  const body = entries
    .map(([key, defs]) => `  ${JSON.stringify(key)}: ${JSON.stringify(defs, null, 2).split("\n").join("\n  ")}`)
    .join(",\n");

  return (
    `import type { FieldDef } from "./normalize-values";\n\n`
    + `export const ${constName}: Record<string, FieldDef[]> = {\n${body}\n};\n`
    + extra
  );
}

export type SlugResolver = (collectionKey: string) => string;
const identitySlug: SlugResolver = (key) => key;

export function emitBlockFieldTypesFile(blocks: BlocksData, slugFor: SlugResolver = identitySlug): string {
  const entries: [string, unknown][] = blocks.blocks.map((block) => [String(block.id), fieldDefsFor(block.fields)]);
  const listEntries = blocks.blocks
    .filter((block) => block.collectionKey !== undefined)
    .map((block) => `  ${JSON.stringify(String(block.id))}: ${JSON.stringify(slugFor(String(block.collectionKey)))}`)
    .join(",\n");
  const registry =
    `\n// blockType -> bound collection slug for collection-list blocks (P09).\n`
    + `export const collectionListBlocks: Record<string, string> = {\n${listEntries}\n};\n`;

  return emitMapFile("blockFieldTypes", entries, registry);
}

export function emitCollectionFieldTypesFile(
  collections: readonly Pick<CollectionEntry, "key" | "fields">[],
  slugFor: SlugResolver = identitySlug,
): string {
  const entries: [string, unknown][] = collections.map((collection) => [
    slugFor(String(collection.key)),
    fieldDefsFor(collection.fields),
  ]);
  return emitMapFile("collectionFieldTypes", entries);
}

export function emitChromeFieldTypesFile(globals: GlobalsData): string {
  const entries: [string, unknown][] = globals.globals.map((def) => [def.name, fieldDefsFor(def.fields)]);
  return emitMapFile("chromeFieldTypes", entries);
}
