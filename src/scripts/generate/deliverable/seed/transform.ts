import type { FieldDef, FieldTypeNode } from "../lib/migration/normalize-values.ts";

export interface SeedCtx {
  htmlToLexical(html: string): unknown;
  resolveAssetId(url: string): string | undefined;
  mediaIdFor(assetId: string): string | number | undefined;
  docIdFor(collectionKey: string, migrationId: string): string | number | undefined;
  warn(message: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function docIdFor(collectionKey: string | undefined, migrationId: unknown, ctx: SeedCtx): string | number | undefined {
  if (collectionKey === undefined || typeof migrationId !== "string") return undefined;
  const docId = ctx.docIdFor(collectionKey, migrationId);
  if (docId === undefined) {
    ctx.warn(`item ${collectionKey}/${migrationId} has no seeded doc — relationship left empty`);
  }
  return docId;
}

export function payloadValueFor(node: FieldTypeNode, value: unknown, ctx: SeedCtx): unknown {
  if (value === null || value === undefined) return undefined;
  switch (node.type) {
    case "image":
    case "file":
    case "video": {
      if (!isRecord(value) || typeof value["assetId"] !== "string") return undefined;
      const assetId = value["assetId"];
      const mediaId = ctx.mediaIdFor(assetId);
      if (mediaId === undefined) ctx.warn(`asset ${assetId} has no seeded media doc — upload field left empty`);
      return mediaId;
    }
    case "richText":
      return typeof value === "string" ?
          ctx.htmlToLexical(
            rewriteImgTags(
              value,
              (url) => {
                const assetId = ctx.resolveAssetId(url);
                return assetId === undefined ? undefined : ctx.mediaIdFor(assetId);
              },
              (msg) => ctx.warn(msg),
            ),
          )
        : undefined;
    case "reference":
      return docIdFor(node.collectionKey, value, ctx);
    case "multiReference": {
      if (!Array.isArray(value)) return undefined;
      return value.map((entry) => docIdFor(node.collectionKey, entry, ctx)).filter((entry) => entry !== undefined);
    }
    case "array": {
      if (!Array.isArray(value) || node.element === undefined) return undefined;
      const element = node.element;
      return value
        .map((entry) => payloadValueFor(element, entry, ctx))
        .filter((entry) => entry !== undefined)
        .map((entry) => ({ item: entry }));
    }
    case "group": {
      if (!isRecord(value) || node.fields === undefined) return undefined;
      return payloadDataForFields(node.fields, value, ctx);
    }
    default:
      return value;
  }
}

export function payloadDataForFields(
  fields: FieldDef[],
  record: Record<string, unknown>,
  ctx: SeedCtx,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const value = payloadValueFor(field.type, record[field.name], ctx);
    if (value !== undefined) out[field.name] = value;
  }
  return out;
}

const IMG_TAG_RE = /<img\b[^>]*>/gi;
const SRC_ATTR_RE = /\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i;

export function rewriteImgTags(
  html: string,
  resolveUploadId: (url: string) => string | number | undefined,
  warn: (message: string) => void,
): string {
  return html.replace(IMG_TAG_RE, (tag) => {
    const src = SRC_ATTR_RE.exec(tag);
    const url = src?.[2] ?? src?.[3];
    if (url === undefined) return tag;
    const uploadId = resolveUploadId(url);
    if (uploadId === undefined) {
      warn(`richText <img> src has no seeded media doc (will be dropped by the converter): ${url}`);
      return tag;
    }
    return tag.replace(
      /^<img\b/i,
      `<img data-lexical-upload-id="${String(uploadId)}" data-lexical-upload-relation-to="media"`,
    );
  });
}

export function collectImgUrls(html: string): string[] {
  const urls: string[] = [];
  for (const tag of html.match(IMG_TAG_RE) ?? []) {
    const src = SRC_ATTR_RE.exec(tag);
    const url = src?.[2] ?? src?.[3];
    if (url !== undefined) urls.push(url);
  }
  return urls;
}

export function collectAssetIdsFromValue(node: FieldTypeNode, value: unknown): string[] {
  if (value === null || value === undefined) return [];
  switch (node.type) {
    case "image":
    case "file":
    case "video":
      return isRecord(value) && typeof value["assetId"] === "string" ? [value["assetId"]] : [];
    case "array":
      return Array.isArray(value) && node.element !== undefined ?
          value.flatMap((entry) => collectAssetIdsFromValue(node.element as FieldTypeNode, entry))
        : [];
    case "group":
      return isRecord(value) && node.fields !== undefined ?
          node.fields.flatMap((field) => collectAssetIdsFromValue(field.type, value[field.name]))
        : [];
    default:
      return [];
  }
}

export function parseNdjson(text: string): { meta: Record<string, unknown>; records: Record<string, unknown>[] } {
  const lines = text.split("\n").filter((line) => line !== "");
  if (lines.length === 0) throw new Error("empty NDJSON artifact");
  const meta = JSON.parse(lines[0] as string) as Record<string, unknown>;
  const records = lines.slice(1).map((line) => JSON.parse(line) as Record<string, unknown>);
  return { meta, records };
}

export function partitionFields(fields: FieldDef[]): { plain: FieldDef[]; refs: FieldDef[] } {
  const isRef = (field: FieldDef): boolean => field.type.type === "reference" || field.type.type === "multiReference";
  return { plain: fields.filter((field) => !isRef(field)), refs: fields.filter(isRef) };
}
