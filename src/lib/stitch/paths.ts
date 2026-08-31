import { join } from "node:path";

import { routeDir } from "#lib/route-dir.ts";

export const STITCH_DIR = ".migration/artifacts/stitch";

export function stitchRouteDirPath(projectPath: string, route: string): string {
  return join(projectPath, STITCH_DIR, routeDir(route));
}

export function stitchPngFile(viewportName: string): string {
  return `${viewportName}.png`;
}

export function stitchPngPath(projectPath: string, route: string, viewportName: string): string {
  return join(stitchRouteDirPath(projectPath, route), stitchPngFile(viewportName));
}

export function stitchIndexPath(projectPath: string, route: string): string {
  return join(stitchRouteDirPath(projectPath, route), "index.json");
}
