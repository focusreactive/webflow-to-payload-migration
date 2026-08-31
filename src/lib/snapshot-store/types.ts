import type { FetchResponse } from "#lib/fetch/create-fetch-client/index.ts";

import type { SnapshotEntry } from "./schema.ts";

export type { SnapshotEntry } from "./schema.ts";

export type SnapshotKind = "page" | "style" | "script" | "data" | "asset" | "probe";

export interface SnapshotStore {
  has(url: string): boolean;
  get(url: string): SnapshotEntry | undefined;
  entries(): SnapshotEntry[];
  fetchInto(
    url: string,
    kind: SnapshotKind,
    opts?: {
      relativePath?: string;
      onResponse?: (response: FetchResponse) => void;
    },
  ): Promise<SnapshotEntry>;
  readBody(entry: SnapshotEntry): Promise<Buffer>;
  attachDerived(
    url: string,
    patch: {
      rendered?: string;
      styles?: string;
    },
  ): Promise<SnapshotEntry>;
  clearExceptProbe(): Promise<void>;
}
