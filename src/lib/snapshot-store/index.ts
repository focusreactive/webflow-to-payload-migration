import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import type { FetchClient, FetchResponse } from "#lib/fetch/create-fetch-client/index.ts";
import { writeFileAtomic } from "#lib/fs.ts";
import { normalizeUrl, routeFromUrl } from "#lib/url.ts";

import { SNAPSHOT_DIR } from "./paths.ts";
import {
  snapshotEntrySchema,
  snapshotIndexSchema,
  SNAPSHOT_INDEX_SCHEMA_VERSION,
  type SnapshotEntry,
  type SnapshotIndex,
} from "./schema.ts";
import type { SnapshotKind, SnapshotStore } from "./types.ts";
import { indexPath, readIndexIfPresent, resolveRelativePath } from "./utils.ts";

const DERIVED_CONTENT_DIRS = ["pages", "styles", "scripts", "data", "assets"];

export function readOnlyClient(): FetchClient {
  return {
    fetch(): Promise<FetchResponse> {
      return Promise.reject(new Error("snapshot store is read-only here"));
    },
    setCrawlDelayMs(): void {
      return;
    },
  };
}

export async function openSnapshotStore(projectPath: string, client: FetchClient): Promise<SnapshotStore> {
  const snapshotDir = join(projectPath, SNAPSHOT_DIR);
  const registry = new Map<string, SnapshotEntry>();

  const reservedRawPaths = new Map<string, SnapshotKind>();

  const existingIndex = await readIndexIfPresent(projectPath);
  if (existingIndex) {
    for (const [url, entry] of Object.entries(existingIndex.entries)) {
      registry.set(url, entry);
    }
  }

  let writeQueue: Promise<void> = Promise.resolve();

  function persistIndex(): Promise<void> {
    const write = async (): Promise<void> => {
      const index: SnapshotIndex = {
        schemaVersion: SNAPSHOT_INDEX_SCHEMA_VERSION,
        entries: Object.fromEntries(registry),
      };
      await writeFileAtomic(indexPath(projectPath), `${JSON.stringify(snapshotIndexSchema.parse(index), null, 2)}\n`);
    };

    const scheduled = writeQueue.then(write, write);

    writeQueue = scheduled.catch(() => undefined);
    return scheduled;
  }

  return {
    has(url: string): boolean {
      return registry.has(normalizeUrl(url));
    },

    get(url: string): SnapshotEntry | undefined {
      return registry.get(normalizeUrl(url));
    },

    entries(): SnapshotEntry[] {
      return [...registry.values()];
    },

    async fetchInto(
      url: string,
      kind: SnapshotKind,
      opts?: {
        relativePath?: string;
        onResponse?: (response: FetchResponse) => void;
      },
    ): Promise<SnapshotEntry> {
      const normalizedUrl = normalizeUrl(url);

      const existingEntry = registry.get(normalizedUrl);
      if (existingEntry) {
        if (existingEntry.kind === "probe" && kind !== "probe") {
          const promoted = snapshotEntrySchema.parse({ ...existingEntry, kind });
          registry.set(normalizedUrl, promoted);
          await persistIndex();
          return promoted;
        }

        return existingEntry;
      }

      const relativePath = resolveRelativePath(kind, normalizedUrl, opts?.relativePath, registry, reservedRawPaths);

      const isReservable = opts?.relativePath === undefined;
      if (isReservable) reservedRawPaths.set(relativePath, kind);

      try {
        const response = await client.fetch(normalizedUrl);
        opts?.onResponse?.(response);
        await writeFileAtomic(join(snapshotDir, relativePath), response.body);

        const { "content-type": contentType, etag, "last-modified": lastModified } = response.headers;

        const entry = snapshotEntrySchema.parse({
          url: normalizedUrl,
          kind,
          paths: { raw: relativePath },
          http: {
            status: response.status,
            finalUrl: response.finalUrl,
            redirectChain: response.redirectChain,
            ...(contentType !== undefined && { contentType }),
            ...(etag !== undefined && { etag }),
            ...(lastModified !== undefined && { lastModified }),
          },
          sha256: createHash("sha256").update(response.body).digest("hex"),
          size: response.body.length,
          fetchedAt: new Date().toISOString(),
        });

        registry.set(normalizedUrl, entry);
        try {
          await persistIndex();
        } catch (error) {
          registry.delete(normalizedUrl);
          throw new Error(`Failed to persist snapshot index after fetching ${normalizedUrl}`, { cause: error });
        }

        return entry;
      } finally {
        if (isReservable) reservedRawPaths.delete(relativePath);
      }
    },

    async readBody(entry: SnapshotEntry): Promise<Buffer> {
      return readFile(join(snapshotDir, entry.paths.raw));
    },

    async attachDerived(
      url: string,
      patch: {
        rendered?: string;
        styles?: string;
      },
    ): Promise<SnapshotEntry> {
      const normalizedUrl = normalizeUrl(url);

      const existingEntry = registry.get(normalizedUrl);
      if (!existingEntry) {
        throw new Error(`attachDerived: no snapshot entry exists for ${normalizedUrl}`);
      }

      const updatedEntry = snapshotEntrySchema.parse({
        ...existingEntry,
        paths: {
          ...existingEntry.paths,
          ...(patch.rendered !== undefined && { rendered: patch.rendered }),
          ...(patch.styles !== undefined && { styles: patch.styles }),
        },
      });

      registry.set(normalizedUrl, updatedEntry);
      await persistIndex();

      return updatedEntry;
    },

    async clearExceptProbe(): Promise<void> {
      for (const [url, entry] of registry) {
        if (entry.kind === "probe") continue;
        if (entry.paths.raw.startsWith("probe/")) {
          registry.set(url, snapshotEntrySchema.parse({ ...entry, kind: "probe", paths: { raw: entry.paths.raw } }));
        } else {
          registry.delete(url);
        }
      }
      await persistIndex();

      await Promise.all(
        DERIVED_CONTENT_DIRS.map((dir) => rm(join(snapshotDir, dir), { recursive: true, force: true })),
      );
    },
  };
}

export function renderedByRoute(store: SnapshotStore): Map<string, string> {
  const map = new Map<string, string>();

  for (const entry of store.entries()) {
    if (entry.kind === "page" && entry.paths.rendered !== undefined) {
      map.set(routeFromUrl(entry.url), entry.paths.rendered);
    }
  }

  return map;
}
