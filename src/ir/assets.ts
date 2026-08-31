import { createHash } from "node:crypto";
import { join } from "node:path";

import { z } from "zod";

import type { ArtifactDef } from "#ir/artifact.ts";
import { assetIdSchema, type AssetId } from "#ir/common.ts";

const ASSET_ID_HEX_LENGTH = 16;

const ARTIFACT_DIR = "assets";

const MEDIA_ASSET_KINDS = ["image", "video"] as const;
const MEDIA_ASSET_SOURCES = [
  "img-src",
  "img-srcset",
  "background-image",
  "css-url",
  "lightbox-json",
  "video-urls",
  "poster-url",
  "og-image",
] as const;
const FONT_ASSET_SOURCES = ["font-face", "webfont-load"] as const;

export const assetStatusSchema = z.enum(["downloaded", "failed"]);
export const mediaAssetKindSchema = z.enum(MEDIA_ASSET_KINDS);
export const mediaAssetSourceSchema = z.enum(MEDIA_ASSET_SOURCES);
export const fontAssetSourceSchema = z.enum(FONT_ASSET_SOURCES);
export const fontClassificationSchema = z.enum(["google", "fontshare", "custom", "adobe"]);

export const fontFaceSchema = z.strictObject({
  family: z.string(),
  weights: z.array(z.string()).default([]),
  style: z.enum(["normal", "italic"]).optional(),
  unicodeRange: z.string().optional(),
  classification: fontClassificationSchema,
  downloaded: z.boolean(),
  licenseRisk: z.boolean(),
});

const assetRecordBase = {
  assetId: assetIdSchema,
  canonicalUrl: z.string(),
  status: assetStatusSchema,
  fileName: z.string().optional(),
  storePath: z.string().optional(),
  contentSha256: z.string().optional(),
  contentType: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
  aliasOf: assetIdSchema.optional(),
  failureReason: z.string().optional(),
};

export const mediaAssetRecordSchema = z.strictObject({
  ...assetRecordBase,
  kind: mediaAssetKindSchema,
  sources: z.array(mediaAssetSourceSchema).min(1),
  alt: z.string().optional(),
  platformId: z.string().optional(),
  originalName: z.string().optional(),
});

export const fontAssetRecordSchema = z.strictObject({
  ...assetRecordBase,
  kind: z.literal("font"),
  sources: z.array(fontAssetSourceSchema).min(1),
  font: fontFaceSchema,
});

export const mediaAssetsDataSchema = z.strictObject({
  assets: z.array(mediaAssetRecordSchema),
});
export const fontAssetsDataSchema = z.strictObject({
  assets: z.array(fontAssetRecordSchema),
});

export type MediaAssetsData = z.infer<typeof mediaAssetsDataSchema>;
export type FontAssetsData = z.infer<typeof fontAssetsDataSchema>;
export type MediaAssetRecord = z.infer<typeof mediaAssetRecordSchema>;
export type FontAssetRecord = z.infer<typeof fontAssetRecordSchema>;
export type MediaAssetKind = z.infer<typeof mediaAssetKindSchema>;
export type MediaAssetSource = z.infer<typeof mediaAssetSourceSchema>;
export type FontFace = z.infer<typeof fontFaceSchema>;
export type FontClassification = z.infer<typeof fontClassificationSchema>;

export const mediaAssetsArtifact: ArtifactDef<MediaAssetsData> = {
  kind: "media",
  relativePath: join(ARTIFACT_DIR, "media.json"),
  schemaVersion: 1,
  dataSchema: mediaAssetsDataSchema,
};

export const fontAssetsArtifact: ArtifactDef<FontAssetsData> = {
  kind: "fonts",
  relativePath: join(ARTIFACT_DIR, "fonts.json"),
  schemaVersion: 1,
  dataSchema: fontAssetsDataSchema,
};

export function assetIdFromCanonicalUrl(canonicalUrl: string): AssetId {
  const hex = createHash("sha256").update(canonicalUrl).digest("hex").slice(0, ASSET_ID_HEX_LENGTH);

  return assetIdSchema.parse(hex);
}
