import type { CollectionId } from "#ir/common.ts";
import type { ContentRecord } from "#ir/content.ts";
import type { FieldType } from "#ir/field-type.ts";
import { readShardJson } from "#lib/synth-store/paths.ts";

import { contentShardPath, schemaShardPath } from "../../../constants/paths.ts";
import type { CollectionContentShard, CollectionSchemaShard } from "../../../verticals/collections.ts";
import type { FieldsForCollection } from "./media-input.ts";

export type ResolveDoc = (collectionKey: CollectionId, id: string) => ContentRecord;
export type DocIndex = Map<CollectionId, Map<string, ContentRecord>>;

function collectReferencedKeys(node: FieldType, into: Set<CollectionId>): void {
  switch (node.type) {
    case "reference":
    case "multiReference":
      into.add(node.collectionKey);
      return;
    case "array":
      collectReferencedKeys(node.element, into);
      return;
    case "group":
      for (const field of node.fields) collectReferencedKeys(field.type, into);
      return;
    default:
      return;
  }
}

function referencedCollectionKeys(fields: { type: FieldType }[]): CollectionId[] {
  const keys = new Set<CollectionId>();
  for (const field of fields) collectReferencedKeys(field.type, keys);
  return [...keys];
}

async function readCollectionContentOrThrow(
  projectPath: string,
  collectionKey: CollectionId,
): Promise<CollectionContentShard> {
  try {
    return await readShardJson<CollectionContentShard>(contentShardPath(projectPath, "collections", collectionKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `reference points at collection "${collectionKey}" but its content.json does not exist yet `
          + `— run --content-accept --collection ${collectionKey} before --input-build`,
        { cause: error },
      );
    }
    throw error;
  }
}

export async function buildDocIndex(projectPath: string, fields: { type: FieldType }[]): Promise<DocIndex> {
  const index: DocIndex = new Map();
  for (const collectionKey of referencedCollectionKeys(fields)) {
    const shard = await readCollectionContentOrThrow(projectPath, collectionKey);
    index.set(collectionKey, new Map(shard.items.map((item) => [item.id, item])));
  }
  return index;
}

export function docResolver(index: DocIndex): ResolveDoc {
  return (collectionKey, id) => {
    const doc = index.get(collectionKey)?.get(id);
    if (doc === undefined) {
      throw new Error(
        `reference points at unknown id "${id}" in collection "${collectionKey}" `
          + `— not found in collections/${collectionKey}/content.json`,
      );
    }
    return doc;
  };
}

export async function buildFieldsIndex(
  projectPath: string,
  fields: { type: FieldType }[],
): Promise<Map<CollectionId, CollectionSchemaShard["fields"]>> {
  const index = new Map<CollectionId, CollectionSchemaShard["fields"]>();
  for (const collectionKey of referencedCollectionKeys(fields)) {
    const shard = await readShardJson<CollectionSchemaShard>(
      schemaShardPath(projectPath, "collections", collectionKey),
    );
    index.set(collectionKey, shard.fields);
  }
  return index;
}

export function fieldsForCollectionResolver(
  index: Map<CollectionId, CollectionSchemaShard["fields"]>,
): FieldsForCollection {
  return (collectionKey) => index.get(collectionKey) ?? [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function resolveDocValue(node: FieldType, value: unknown, resolveDoc: ResolveDoc): unknown {
  if (value === null || value === undefined) return value;
  switch (node.type) {
    case "reference":
      return typeof value === "string" ? resolveDoc(node.collectionKey, value) : value;
    case "multiReference":
      return Array.isArray(value) ?
          (value as unknown[]).map((id) => (typeof id === "string" ? resolveDoc(node.collectionKey, id) : id))
        : value;
    case "array":
      return Array.isArray(value) ? value.map((item) => resolveDocValue(node.element, item, resolveDoc)) : value;
    case "group": {
      if (!isRecord(value)) return value;
      const out: Record<string, unknown> = { ...value };
      for (const field of node.fields) {
        out[field.name] = resolveDocValue(field.type, value[field.name], resolveDoc);
      }
      return out;
    }
    default:
      return value;
  }
}

export function resolveDocRecord(
  fields: { name: string; type: FieldType }[],
  record: Record<string, unknown>,
  resolveDoc: ResolveDoc,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...record };
  for (const field of fields) {
    if (field.name in record) out[field.name] = resolveDocValue(field.type, record[field.name], resolveDoc);
  }
  return out;
}
