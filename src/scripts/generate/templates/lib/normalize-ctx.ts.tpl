import { collectionFieldTypes } from "./collection-field-types";
import { collectionSlugs } from "./collection-slugs";
import type { NormalizeCtx } from "./normalize-values";

export const normalizeCtx: NormalizeCtx = {
  resolveCollectionFields: (collectionKey) => collectionFieldTypes[collectionSlugs[collectionKey] ?? collectionKey],
};
