import { join } from "node:path";

import { routeFromUrl } from "#lib/url.ts";

import { openSnapshotStore, readOnlyClient } from "./index.ts";
import { SNAPSHOT_DIR } from "./paths.ts";

export async function resolveSnapshotPaths(
  projectPath: string,
  route: string,
): Promise<{ renderedHtmlPath: string; stylesPath: string }> {
  const store = await openSnapshotStore(projectPath, readOnlyClient());
  for (const entry of store.entries()) {
    if (entry.kind !== "page" || routeFromUrl(entry.url) !== route) continue;
    const abs = (rel: string | undefined): string => (rel === undefined ? "" : join(projectPath, SNAPSHOT_DIR, rel));

    return {
      renderedHtmlPath: abs(entry.paths.rendered),
      stylesPath: abs(entry.paths.styles),
    };
  }

  return {
    renderedHtmlPath: "",
    stylesPath: "",
  };
}
