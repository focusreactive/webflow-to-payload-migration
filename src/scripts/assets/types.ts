import type { CanonicalAsset } from "#adapters/webflow/media-normalize.ts";
import type { FontFace, MediaAssetKind, MediaAssetSource } from "#ir/assets.ts";
import type { Logger } from "#lib/logger.ts";
import type { SnapshotStore } from "#lib/snapshot-store/types.ts";

export interface MediaNormalizer {
  canonicalize(rawUrl: string): CanonicalAsset;
  isVariant(rawUrl: string): boolean;
  fileName(canonicalUrl: string): string;
}

export interface ScannedMediaRef {
  rawUrl: string;
  source: MediaAssetSource;
  hint: MediaAssetKind;
  alt?: string;
}

export interface MediaGroup {
  canonicalUrl: string;
  kind: MediaAssetKind;
  sources: Set<MediaAssetSource>;
  alts: string[];
  platformId?: string;
  originalName?: string;
}

export interface BuildMediaAssetsOpts {
  store: SnapshotStore;
  normalizer: MediaNormalizer;
  logger: Logger;
}

export interface FontFaceSrc {
  family: string;
  weight?: string;
  style?: "normal" | "italic";
  unicodeRange?: string;
  srcUrl?: string;
}

export interface FontFamilyRecord {
  family: string;
  face: FontFace;
  srcUrl?: string;
}
