import { readArtifact } from "#ir/artifact.ts";
import { pagesArtifact } from "#ir/pages.ts";
import { openSnapshotStore, readOnlyClient, renderedByRoute } from "#lib/snapshot-store/index.ts";

import type { LayoutStaticUnit } from "../types.ts";

import { planLayoutUnits } from "./plan-layout-units.ts";

export async function loadUnits(projectPath: string): Promise<LayoutStaticUnit[]> {
  const { data: pages } = await readArtifact(projectPath, pagesArtifact);
  const store = await openSnapshotStore(projectPath, readOnlyClient());

  return planLayoutUnits({ pages, rendered: renderedByRoute(store) });
}
