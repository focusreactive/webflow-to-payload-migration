import { type CollectionEntry } from "#ir/collections.ts";

import { collectionSlug, RESERVED_COLLECTION_KEYS } from "./collection-slugs.ts";
import { payloadField, type SlugResolver } from "./fields.ts";
import { pascalCase } from "./names.ts";

export { pascalCase, RESERVED_COLLECTION_KEYS };

export function collectionConfigName(slug: string): string {
  return `${pascalCase(slug)}Collection`;
}

export function collectionFileName(slug: string): string {
  return `${pascalCase(slug)}.ts`;
}

export function collectionTitleField(collection: Pick<CollectionEntry, "fields">): string {
  return collection.fields.find((field) => field.type.type === "text")?.name ?? "id";
}

// The IR field types whose Payload-mapped value carries translatable prose. Ids, media
// references and relationships stay shared across locales. "option" is deliberately excluded
// too: its stored value is a fixed enum key (e.g. "draft"), not display text, so localizing it
// would just fork the same key per locale rather than translate anything.
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
