import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { z } from "zod";

import { mirrorPath, SNAPSHOT_DIR } from "./paths.ts";
import {
  snapshotIndexSchema,
  SNAPSHOT_INDEX_SCHEMA_VERSION,
  type SnapshotEntry,
  type SnapshotIndex,
} from "./schema.ts";
import type { SnapshotKind } from "./types.ts";

export function indexPath(projectPath: string): string {
  return join(projectPath, SNAPSHOT_DIR, "index.json");
}

const versionProbeSchema = z.looseObject({ schemaVersion: z.number() });

export async function readIndexIfPresent(projectPath: string): Promise<SnapshotIndex | undefined> {
  const filePath = indexPath(projectPath);
  if (!existsSync(filePath)) return undefined;

  const raw: unknown = JSON.parse(await readFile(filePath, "utf8"));

  const probe = versionProbeSchema.parse(raw);
  if (probe.schemaVersion !== SNAPSHOT_INDEX_SCHEMA_VERSION) {
    throw new Error(
      `snapshot index has schemaVersion ${probe.schemaVersion}, this tool expects ${SNAPSHOT_INDEX_SCHEMA_VERSION} `
        + `(full-page screenshots were replaced by windowed captures). `
        + `Delete ${SNAPSHOT_DIR}/index.json in the project and re-run the snapshot step with --refresh.`,
    );
  }

  return snapshotIndexSchema.parse(raw);
}

export function resolveRelativePath(
  kind: SnapshotKind,
  normalizedUrl: string,
  explicitRelativePath: string | undefined,
  registry: ReadonlyMap<string, SnapshotEntry>,
  reservedRawPaths: ReadonlyMap<string, SnapshotKind>,
): string {
  if (explicitRelativePath !== undefined) return explicitRelativePath;

  if (kind === "probe") {
    throw new Error("fetchInto: kind 'probe' requires opts.relativePath (mirrorPath does not support 'probe')");
  }

  const existing = new Set<string>();
  for (const entry of registry.values()) {
    if (entry.kind === kind) existing.add(basename(entry.paths.raw));
  }
  for (const [rawPath, reservedKind] of reservedRawPaths) {
    if (reservedKind === kind) existing.add(basename(rawPath));
  }

  return mirrorPath(kind, normalizedUrl, { existing });
}
