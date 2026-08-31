import { join } from "node:path/posix";

import { sanitizeFileName } from "#lib/fs.ts";
import { routeFromUrl } from "#lib/url.ts";

import type { SnapshotKind } from "./types.ts";

export const SNAPSHOT_DIR = ".migration/snapshot";

export const ASSETS_MIRROR_DIR = "assets";

const FILE_KIND_DIRS: Record<Exclude<SnapshotKind, "probe" | "page">, string> = {
  style: "styles",
  script: "scripts",
  data: "data",
  asset: join(ASSETS_MIRROR_DIR, "media"),
};

export function pageMirrorPathForRoute(route: string): string {
  const segments = route
    .split("/")
    .filter(Boolean)
    .map((segment) => sanitizeFileName(segment));

  return join("pages", ...segments, "index.html");
}

export function mirrorPath(
  kind: Exclude<SnapshotKind, "probe">,
  normalizedUrl: string,
  opts?: { existing?: ReadonlySet<string> },
): string {
  if (kind === "page") {
    return pageMirrorPathForRoute(routeFromUrl(normalizedUrl));
  }

  const fileName = sanitizeFileName(lastPathSegment(normalizedUrl), opts);

  return join(FILE_KIND_DIRS[kind], fileName);
}

function lastPathSegment(url: string): string {
  const segments = new URL(url).pathname.split("/").filter(Boolean);

  return segments.at(-1) ?? "";
}

function withPageFileName(rawPagePath: string, fileName: string): string {
  const segments = rawPagePath.split("/");
  segments[segments.length - 1] = fileName;

  return join(...segments);
}

export function renderedPathFor(rawPagePath: string): string {
  return withPageFileName(rawPagePath, "index.rendered.html");
}

export function stylesPathFor(rawPagePath: string): string {
  return withPageFileName(rawPagePath, "index.styles.json");
}
