import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { mediaAssetsArtifact, type MediaAssetsData } from "#ir/assets.ts";
import { readArtifact } from "#ir/artifact.ts";
import { normalizeUrl } from "#lib/url.ts";
import { mediaNormalizerFor } from "#assets/media-normalizer-for.ts";
import { openSnapshotStore, readOnlyClient } from "#lib/snapshot-store/index.ts";
import { SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";
import type { SnapshotStore } from "#lib/snapshot-store/types.ts";

const ID_LENGTH = 16;
const VARIANT_SUFFIX_PATTERN = /-p-\d+\./;

export interface ReplayBody {
  body: Buffer;
  url: string;
  contentType?: string;
}

export interface ReplayLookup {
  idFor(url: string): string | undefined;
  read(id: string): Promise<ReplayBody | undefined>;
}

type Source = { kind: "store"; url: string } | { kind: "file"; path: string; contentType?: string };

function idOf(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, ID_LENGTH);
}

function tryNormalize(url: string): string | undefined {
  try {
    return normalizeUrl(url);
  } catch {
    return undefined;
  }
}

async function loadAssets(projectPath: string): Promise<MediaAssetsData | undefined> {
  try {
    return (await readArtifact(projectPath, mediaAssetsArtifact)).data;
  } catch {
    return undefined;
  }
}

export async function createReplayLookup(projectPath: string): Promise<ReplayLookup> {
  const store: SnapshotStore = await openSnapshotStore(projectPath, readOnlyClient());
  const byId = new Map<string, Source>();
  const idByUrl = new Map<string, string>();
  const urlById = new Map<string, string>();

  const register = (url: string, source: Source): string => {
    const id = idOf(url);
    byId.set(id, source);
    idByUrl.set(url, id);
    urlById.set(id, url);
    return id;
  };

  for (const entry of store.entries()) register(entry.url, { kind: "store", url: entry.url });

  const assets = await loadAssets(projectPath);
  for (const asset of assets?.assets ?? []) {
    if (asset.storePath === undefined) continue;
    register(asset.canonicalUrl, {
      kind: "file",
      path: join(projectPath, SNAPSHOT_DIR, asset.storePath),
      ...(asset.contentType !== undefined ? { contentType: asset.contentType } : {}),
    });
  }

  const normalizer = mediaNormalizerFor();

  const idFor = (url: string): string | undefined => {
    const direct = idByUrl.get(url);
    if (direct !== undefined) return direct;

    const normalized = tryNormalize(url);
    const normalizedHit = normalized === undefined ? undefined : idByUrl.get(normalized);
    if (normalizedHit !== undefined) return normalizedHit;

    let canonical: string;
    try {
      canonical = normalizer.canonicalize(url).canonicalUrl;
    } catch {
      return undefined;
    }
    const hit = idByUrl.get(canonical);
    if (hit !== undefined) return hit;
    return normalizer.isVariant(url) ? idByUrl.get(canonical.replace(VARIANT_SUFFIX_PATTERN, ".")) : undefined;
  };

  const read = async (id: string): Promise<ReplayBody | undefined> => {
    const source = byId.get(id);
    const url = urlById.get(id);
    if (source === undefined || url === undefined) return undefined;
    if (source.kind === "file") {
      if (!existsSync(source.path)) return undefined;
      return {
        body: await readFile(source.path),
        url,
        ...(source.contentType !== undefined ? { contentType: source.contentType } : {}),
      };
    }
    const hit = store.get(source.url);
    if (hit === undefined) return undefined;
    const contentType = hit.http.contentType;
    return { body: await store.readBody(hit), url, ...(contentType !== undefined ? { contentType } : {}) };
  };

  return { idFor, read };
}
