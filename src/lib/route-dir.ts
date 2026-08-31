import { join } from "node:path/posix";

import { sanitizeFileName } from "#lib/fs.ts";

export function routeDir(route: string): string {
  const segments = route
    .split("/")
    .filter(Boolean)
    .map((segment) => sanitizeFileName(segment));

  return join(...(segments.length > 0 ? segments : ["index"]));
}
