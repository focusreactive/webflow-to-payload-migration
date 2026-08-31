import { resolve } from "node:path";

import { readArtifact } from "#ir/artifact.ts";
import { mediaAssetsArtifact, type MediaAssetsData } from "#ir/assets.ts";
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

export function resolveMediaValue(
  node: FieldType,
  value: unknown,
  srcOf: (assetId: string) => string | undefined,
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
    case "array":
      return Array.isArray(value) ? value.map((item) => resolveMediaValue(node.element, item, srcOf)) : value;
    case "group": {
      if (!isRecord(value)) return value;
      const out: Record<string, unknown> = { ...value };
      for (const field of node.fields) {
        out[field.name] = resolveMediaValue(field.type, value[field.name], srcOf);
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
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...record };
  for (const field of fields) {
    if (field.name in record) out[field.name] = resolveMediaValue(field.type, record[field.name], srcOf);
  }
  return out;
}
