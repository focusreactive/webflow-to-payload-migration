import { blockComponentName, blockDirName } from "#blocks/codegen/names.ts";
import { type BlockType } from "#ir/blocks.ts";
import { type CollectionEntry } from "#ir/collections.ts";

import { payloadField } from "../../payload-field.ts";
import { type SlugResolver } from "../../types.ts";

import { collectionSlug } from "./collection-slugs.ts";
import { pascalCase } from "./utils/names.ts";

export function collectionConfigName(slug: string): string {
  return `${pascalCase(slug)}Collection`;
}

export function collectionFileName(slug: string): string {
  return `${pascalCase(slug)}.ts`;
}

export function collectionTitleField(collection: Pick<CollectionEntry, "fields">): string {
  return collection.fields.find((field) => field.type.type === "text")?.name ?? "id";
}

const LOCALIZED_FIELD_TYPES = new Set(["text", "richText"]);

function withLocalization(emitted: Record<string, unknown>, typeName: string): Record<string, unknown> {
  return LOCALIZED_FIELD_TYPES.has(typeName) ? { ...emitted, localized: true } : emitted;
}

export function emitCmsCollectionFile(
  collection: Pick<CollectionEntry, "key" | "label" | "fields">,
  slug: string = collectionSlug(collection),
  slugFor: SlugResolver = (key) => key,
): string {
  const name = collectionConfigName(slug);
  const firstText = collectionTitleField(collection);

  const fields = collection.fields.map((field) => {
    if (field.name === "slug") return { name: "slug", type: "text", required: true, unique: true, index: true };

    const emitted = withLocalization(payloadField(field, slugFor), field.type.type);

    const isRelationship = field.type.type === "reference" || field.type.type === "multiReference";
    if (!isRelationship) return emitted;

    const rest = { ...emitted };

    delete rest["required"];
    return rest;
  });

  const body = JSON.stringify(
    {
      slug,
      labels: { singular: collection.label, plural: collection.label },
      admin: { group: "Content", useAsTitle: firstText, defaultColumns: [firstText, "updatedAt"] },
      fields,
    },
    null,
    2,
  );

  return `import type { CollectionConfig } from "payload";

import { anyone, or, superAdmin, user } from "@/lib/access";

export const ${name}: CollectionConfig = {
  access: {
    create: or(superAdmin, user),
    delete: or(superAdmin, user),
    read: anyone,
    update: or(superAdmin, user),
  },
  ...(${body} as Omit<CollectionConfig, "access">),
};
`;
}

export function emitPagesCollectionFile(blocks: BlockType[]): string {
  const imports = blocks
    .map((block) => `import { ${blockComponentName(block.id)} } from "@/blocks/${blockDirName(block.id)}/config";`)
    .join("\n");
  const blockNames = blocks.map((block) => blockComponentName(block.id)).join(", ");

  return `import type { CollectionConfig } from "payload";

${imports}

export const PagesCollection: CollectionConfig = {
  slug: "pages",
  access: { read: () => true },
  admin: { useAsTitle: "title" },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true, index: true },
    { name: "layout", type: "blocks", blocks: [${blockNames}] },
  ],
};
`;
}
