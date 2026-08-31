import { loadHtml } from "#lib/html.ts";
import { normalizeUrl } from "#lib/url.ts";

import type { StyleEntry } from "../types.ts";

export type DepKind = "style" | "script" | "data";

const STATIC_LINK_RELS = new Set(["stylesheet", "modulepreload", "preload"]);

const EXTENSION_KINDS: Record<string, DepKind> = {
  css: "style",
  js: "script",
  mjs: "script",
  json: "data",
};

export function classifyDepUrl(url: string): DepKind | undefined {
  const path = pathOf(url);
  const dotIndex = path.lastIndexOf(".");

  if (dotIndex === -1) return undefined;

  const extension = path.slice(dotIndex + 1).toLowerCase();

  return EXTENSION_KINDS[extension];
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split(/[?#]/)[0] ?? "";
  }
}

export function extractStaticDeps(html: string, baseUrl: string): string[] {
  const $ = loadHtml(html);
  const urls: string[] = [];

  $("link").each((_, el) => {
    const rel = $(el).attr("rel");
    const href = $(el).attr("href");

    if (rel === undefined || href === undefined) return;
    if (!STATIC_LINK_RELS.has(rel)) return;

    const resolved = resolveUrl(href, baseUrl);
    if (resolved !== undefined) urls.push(resolved);
  });

  $("script").each((_, el) => {
    const src = $(el).attr("src");

    if (src === undefined) return;

    const resolved = resolveUrl(src, baseUrl);
    if (resolved !== undefined) urls.push(resolved);
  });

  return urls;
}

function resolveUrl(value: string, baseUrl: string): string | undefined {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

export function unionDeps(staticUrls: string[], networkUrls: string[]): string[] {
  const seen = new Map<string, string>();

  for (const url of [...staticUrls, ...networkUrls]) {
    if (classifyDepUrl(url) === undefined) continue;

    const key = normalizeUrl(url);
    if (!seen.has(key)) seen.set(key, url);
  }

  return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  const sorted: Record<string, T> = {};
  for (const key of Object.keys(record).sort()) {
    const value = record[key];
    if (value !== undefined) sorted[key] = value;
  }
  return sorted;
}

// The sidecar carries the curated props only; the measured rects reach disk
// through the stitch index, which is written from the same in-memory render.
export function serializeStyles(styles: Record<string, StyleEntry>): string {
  const sortedStyles: Record<string, Record<string, string>> = {};
  for (const migId of Object.keys(styles).sort()) {
    const entry = styles[migId];
    if (!entry) continue;

    sortedStyles[migId] = sortRecord(entry.props);
  }

  return JSON.stringify(sortedStyles, null, 2) + "\n";
}
