import type { SnapshotEntry, SnapshotStore } from "#lib/snapshot-store/types.ts";

import { HTTP_ERROR_STATUS_THRESHOLD } from "../constants/http.ts";

export function findByRelativePath(store: SnapshotStore, relativePath: string): SnapshotEntry | undefined {
  const matches = store.entries().filter((entry) => entry.paths.raw === relativePath);

  return matches.find((entry) => entry.http.status < HTTP_ERROR_STATUS_THRESHOLD) ?? matches[0];
}

export async function readOkBody(store: SnapshotStore, entry: SnapshotEntry | undefined): Promise<string | undefined> {
  if (!entry || entry.http.status >= HTTP_ERROR_STATUS_THRESHOLD) {
    return undefined;
  }
  return (await store.readBody(entry)).toString("utf8");
}
