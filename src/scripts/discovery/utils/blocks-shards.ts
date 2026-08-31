import { existsSync } from "node:fs";

import { artifactPath, readArtifact } from "#ir/artifact.ts";
import { blocksShardArtifactFor, type BlocksShardData } from "#ir/discovery.ts";
import type { PagesData } from "#ir/pages.ts";
import { routeDir } from "#lib/route-dir.ts";

import { representativeStaticRoutes } from "./representative-routes.ts";

export function hasBlocksShard(projectPath: string, route: string): boolean {
  return existsSync(artifactPath(projectPath, blocksShardArtifactFor(routeDir(route))));
}

export function routesMissingShard(projectPath: string, routes: string[]): string[] {
  return routes.filter((route) => !hasBlocksShard(projectPath, route));
}

export async function readStaticBlocksShards(
  projectPath: string,
  pages: PagesData,
): Promise<{ route: string; data: BlocksShardData }[]> {
  const shards: { route: string; data: BlocksShardData }[] = [];
  for (const route of representativeStaticRoutes(pages)) {
    if (!hasBlocksShard(projectPath, route)) continue;
    const { data } = await readArtifact(projectPath, blocksShardArtifactFor(routeDir(route)));
    shards.push({ route, data });
  }
  return shards;
}
