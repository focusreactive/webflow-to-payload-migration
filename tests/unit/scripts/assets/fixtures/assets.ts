import { createHash } from "node:crypto";

import type { Logger } from "#lib/logger.ts";
import type { SnapshotEntry, SnapshotStore } from "#lib/snapshot-store/types.ts";
import { normalizeUrl } from "#lib/url.ts";

export const SITE = "66ba00000000000000000001";
export const A1 = "aa000000000000000000000a";
export const A2 = "bb000000000000000000000b";

export const cdn = (path: string): string => `https://cdn.prod.website-files.com${path}`;

export const nullLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export interface FakeStoreConfig {
  pages: { url: string; html: string }[];
  styles?: { url: string; css: string }[];
  assets?: Record<string, { bytes: Buffer; contentType?: string; status?: number }>;
}

export function makeFakeStore(config: FakeStoreConfig): SnapshotStore {
  const registered = new Map<string, SnapshotEntry>();
  const bodies = new Map<string, Buffer>();

  const register = (
    url: string,
    kind: SnapshotEntry["kind"],
    raw: string,
    body: Buffer,
    http?: Partial<SnapshotEntry["http"]>,
  ): SnapshotEntry => {
    const key = normalizeUrl(url);
    const entry: SnapshotEntry = {
      url: key,
      kind,
      paths: { raw },
      http: {
        status: 200,
        finalUrl: key,
        redirectChain: [],
        ...http,
      },
      sha256: createHash("sha256").update(body).digest("hex"),
      size: body.length,
      fetchedAt: "2020-01-01T00:00:00.000Z",
    };
    registered.set(key, entry);
    bodies.set(key, body);
    return entry;
  };

  for (const [i, page] of config.pages.entries()) {
    register(page.url, "page", `pages/${i}.html`, Buffer.from(page.html));
  }
  for (const [i, style] of (config.styles ?? []).entries()) {
    register(style.url, "style", `styles/${i}.css`, Buffer.from(style.css));
  }

  return {
    has: (url) => registered.has(normalizeUrl(url)),
    get: (url) => registered.get(normalizeUrl(url)),
    entries: () => [...registered.values()],
    readBody: (entry) => Promise.resolve(bodies.get(entry.url) ?? Buffer.alloc(0)),
    fetchInto: (url, kind) => {
      const key = normalizeUrl(url);
      const existing = registered.get(key);
      if (existing) return Promise.resolve(existing);
      const asset = config.assets?.[key];
      const status = asset?.status ?? (asset ? 200 : 404);
      const body = asset?.bytes ?? Buffer.alloc(0);
      return Promise.resolve(
        register(key, kind === "asset" ? "asset" : "data", `assets/${key.split("/").pop() ?? "x"}`, body, {
          status,
          ...(asset?.contentType !== undefined && { contentType: asset.contentType }),
        }),
      );
    },
    attachDerived: (url) => Promise.resolve(registered.get(normalizeUrl(url)) as SnapshotEntry),
    clearExceptProbe: () => Promise.resolve(),
  };
}
