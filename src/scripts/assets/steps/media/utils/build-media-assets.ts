import { assetIdFromCanonicalUrl, type MediaAssetRecord } from "#ir/assets.ts";
import type { SnapshotEntry } from "#lib/snapshot-store/types.ts";

import { HTTP_ERROR_STATUS_THRESHOLD } from "../../../constants/http.ts";
import type { BuildMediaAssetsOpts, MediaGroup, MediaNormalizer, ScannedMediaRef } from "../../../types.ts";

function mostFrequent(values: readonly string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value.trim() !== "") counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export function groupMediaRefs(refs: readonly ScannedMediaRef[], normalizer: MediaNormalizer): MediaGroup[] {
  const groups = new Map<string, MediaGroup>();
  for (const ref of refs) {
    if (normalizer.isVariant(ref.rawUrl)) continue;
    const canonical = normalizer.canonicalize(ref.rawUrl);
    const group = groups.get(canonical.canonicalUrl) ?? {
      canonicalUrl: canonical.canonicalUrl,
      kind: "image" as const,
      sources: new Set<ScannedMediaRef["source"]>(),
      alts: [],
      ...(canonical.platformId !== undefined && { platformId: canonical.platformId }),
      ...(canonical.originalName !== undefined && { originalName: canonical.originalName }),
    };
    group.sources.add(ref.source);
    if (ref.hint === "video") group.kind = "video";
    if (ref.alt !== undefined) group.alts.push(ref.alt);
    groups.set(canonical.canonicalUrl, group);
  }
  return [...groups.values()].sort((a, b) => a.canonicalUrl.localeCompare(b.canonicalUrl));
}

export async function buildMediaAssetRecord(group: MediaGroup, opts: BuildMediaAssetsOpts): Promise<MediaAssetRecord> {
  const { store, normalizer, logger } = opts;
  const assetId = assetIdFromCanonicalUrl(group.canonicalUrl);
  const sources = [...group.sources].sort();
  const alt = mostFrequent(group.alts);
  const fileName = normalizer.fileName(group.canonicalUrl);

  const base = {
    assetId,
    kind: group.kind,
    canonicalUrl: group.canonicalUrl,
    sources,
    fileName,
    ...(alt !== undefined && { alt }),
    ...(group.platformId !== undefined && { platformId: group.platformId }),
    ...(group.originalName !== undefined && { originalName: group.originalName }),
  } satisfies Partial<MediaAssetRecord>;

  let entry: SnapshotEntry | undefined;
  let failureReason: string | undefined;
  try {
    entry = await store.fetchInto(group.canonicalUrl, "asset");
  } catch (error) {
    failureReason = error instanceof Error ? error.message : String(error);
  }

  if (entry !== undefined && entry.http.status < HTTP_ERROR_STATUS_THRESHOLD) {
    return {
      ...base,
      status: "downloaded",
      storePath: entry.paths.raw,
      contentSha256: entry.sha256,
      size: entry.size,
      ...(entry.http.contentType !== undefined && {
        contentType: entry.http.contentType,
      }),
    };
  }

  const reason = failureReason ?? `HTTP ${entry?.http.status ?? "error"}`;
  logger.warn("media: asset download failed", {
    url: group.canonicalUrl,
    reason,
  });
  return { ...base, status: "failed", failureReason: reason };
}

export function applyContentDedup(records: MediaAssetRecord[]): void {
  const firstByHash = new Map<string, MediaAssetRecord>();
  for (const record of records) {
    if (record.contentSha256 === undefined) continue;
    const first = firstByHash.get(record.contentSha256);
    if (first === undefined) {
      firstByHash.set(record.contentSha256, record);
    } else {
      record.aliasOf = first.assetId;
    }
  }
}
