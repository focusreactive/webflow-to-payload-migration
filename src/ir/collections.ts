import { z } from "zod";

import type { ArtifactDef } from "#ir/artifact.ts";
import { collectionIdSchema } from "#ir/common.ts";
import { contentRecordSchema } from "#ir/content.ts";
import { collectionFieldSchema, type CollectionField } from "#ir/schema.ts";

export const COLLECTIONS_SCHEMA_VERSION = 3;

export const pageBindingSchema = z.strictObject({
  slugField: z.string().min(1),
  meta: z.strictObject({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    ogImage: z.string().min(1).optional(),
  }),
});
export type PageBinding = z.infer<typeof pageBindingSchema>;

export const sectionBindingSchema = z.strictObject({
  sectionId: z.string().min(1),
  itemFields: z.array(z.string().min(1)),
});
export type SectionBinding = z.infer<typeof sectionBindingSchema>;

export const collectionEntrySchema = z.strictObject({
  key: collectionIdSchema,
  label: z.string().min(1),
  fields: z.array(collectionFieldSchema).min(1),
  pageBinding: pageBindingSchema,
  items: z.array(contentRecordSchema),
  template: z.array(sectionBindingSchema).default([]),
});
export type CollectionEntry = z.infer<typeof collectionEntrySchema>;

export const collectionsDataSchema = z.strictObject({ collections: z.array(collectionEntrySchema) });
export type CollectionsData = z.infer<typeof collectionsDataSchema>;

export const collectionsArtifact: ArtifactDef<CollectionsData> = {
  kind: "collections",
  relativePath: "collections.json",
  schemaVersion: COLLECTIONS_SCHEMA_VERSION,
  dataSchema: collectionsDataSchema,
};

export function validatePageBinding(entry: {
  fields: CollectionField[];
  pageBinding: PageBinding;
}): string[] {
  const errors: string[] = [];
  const byName = new Map(entry.fields.map((field) => [field.name, field]));

  const slugField = byName.get(entry.pageBinding.slugField);
  if (!slugField) errors.push(`pageBinding.slugField "${entry.pageBinding.slugField}" is not a field of the collection`);
  else if (slugField.type.type !== "text") errors.push(`pageBinding.slugField "${entry.pageBinding.slugField}" must be a text field`);

  for (const [metaKey, fieldKey] of Object.entries(entry.pageBinding.meta)) {
    if (fieldKey !== undefined && !byName.has(fieldKey)) {
      errors.push(`pageBinding.meta.${metaKey} references unknown field "${fieldKey}"`);
    }
  }
  return errors;
}
