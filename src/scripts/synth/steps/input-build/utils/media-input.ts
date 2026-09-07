import { resolve } from "node:path";

import { readArtifact } from "#ir/artifact.ts";
import { mediaAssetsArtifact, type MediaAssetsData } from "#ir/assets.ts";
import type { CollectionId } from "#ir/common.ts";
import type { FieldType } from "#ir/field-type.ts";
import { SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";

export async function readAssetsData(projectPath: string): Promise<MediaAssetsData | undefined> {
  try {
    return (await readArtifact(projectPath, mediaAssetsArtifact)).data;
  } catch {
    return undefined;
  }
}

export function buildAssetSrcIndex(projectPath: string, assets: MediaAssetsData | undefined): Map<string, string> {
  const index = new Map<string, string>();
  for (const asset of assets?.assets ?? []) {
    if (asset.storePath === undefined) continue;
    index.set(asset.assetId, `/@fs${resolve(projectPath, SNAPSHOT_DIR, asset.storePath)}`);
  }
  return index;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export type FieldsForCollection = (collectionKey: CollectionId) => { name: string; type: FieldType }[];

export function resolveMediaValue(
  node: FieldType,
  value: unknown,
  srcOf: (assetId: string) => string | undefined,
  fieldsForCollection: FieldsForCollection,
): unknown {
  if (value === null || value === undefined) return value;
  switch (node.type) {
    case "image":
    case "file":
    case "video": {
      if (!isRecord(value) || typeof value["assetId"] !== "string") return value;
      const alt = value["alt"];
      return { src: srcOf(value["assetId"]) ?? "", ...(typeof alt === "string" && alt !== "" ? { alt } : {}) };
    }
    case "reference":
      return isRecord(value) ? resolveMediaRecord(fieldsForCollection(node.collectionKey), value, srcOf, fieldsForCollection) : value;
    case "multiReference": {
      if (!Array.isArray(value)) return value;
      const docFields = fieldsForCollection(node.collectionKey);
      const resolveEntry = (entry: unknown): unknown =>
        isRecord(entry) ? resolveMediaRecord(docFields, entry, srcOf, fieldsForCollection) : entry;
      return value.map(resolveEntry);
    }
    case "array":
      return Array.isArray(value) ?
          value.map((item) => resolveMediaValue(node.element, item, srcOf, fieldsForCollection))
        : value;
    case "group": {
      if (!isRecord(value)) return value;
      const out: Record<string, unknown> = { ...value };
      for (const field of node.fields) {
        out[field.name] = resolveMediaValue(field.type, value[field.name], srcOf, fieldsForCollection);
      }
      return out;
    }
    default:
      return value;
  }
}

export function resolveMediaRecord(
  fields: { name: string; type: FieldType }[],
  record: Record<string, unknown>,
  srcOf: (assetId: string) => string | undefined,
  fieldsForCollection: FieldsForCollection,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...record };
  for (const field of fields) {
    if (field.name in record) out[field.name] = resolveMediaValue(field.type, record[field.name], srcOf, fieldsForCollection);
  }
  return out;
}
