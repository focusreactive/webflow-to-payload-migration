import type { BlockField } from "#ir/blocks.ts";
import { buildDocIndex, docResolver, resolveDocRecord, type ResolveDoc } from "./utils/doc-input.ts";
import { buildAssetSrcIndex, readAssetsData, resolveMediaRecord } from "./utils/media-input.ts";
import { writeShardJson, type Vertical } from "#lib/synth-store/paths.ts";

import { inputPath } from "../../constants/paths.ts";
import { resolveRichTextRecord } from "../../utils/richtext/verify-input.ts";

export interface BuildEntityInputOptions {
  fields: BlockField[];
  literals: Record<string, unknown>;
  resolveAssetSrc: (assetId: string) => string | undefined;
  resolveDoc: ResolveDoc;
}

export async function buildEntityInput(opts: BuildEntityInputOptions): Promise<Record<string, unknown>> {
  const withDocs = resolveDocRecord(opts.fields, opts.literals, opts.resolveDoc);
  const withMedia = resolveMediaRecord(opts.fields, withDocs, opts.resolveAssetSrc);
  return resolveRichTextRecord(opts.fields, withMedia, { resolveImgSrc: opts.resolveAssetSrc });
}

export interface WriteEntityInputOptions {
  projectPath: string;
  vertical: Vertical;
  entityKey: string;
  fields: BlockField[];
  literals: Record<string, unknown>;
}

export async function writeEntityInput(opts: WriteEntityInputOptions): Promise<string> {
  const srcIndex = buildAssetSrcIndex(opts.projectPath, await readAssetsData(opts.projectPath));
  const docIndex = await buildDocIndex(opts.projectPath, opts.fields);
  const input = await buildEntityInput({
    fields: opts.fields,
    literals: opts.literals,
    resolveAssetSrc: (assetId) => srcIndex.get(assetId),
    resolveDoc: docResolver(docIndex),
  });
  const path = inputPath(opts.projectPath, opts.vertical, opts.entityKey);
  await writeShardJson(path, input);
  return path;
}
